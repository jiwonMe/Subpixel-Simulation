use image::{ImageBuffer, Rgb, RgbImage, Rgba, RgbaImage};
use image::imageops::{blur, resize, FilterType};
use std::path::Path;
use std::env;

fn extract_hangul_image(
    img: &RgbImage,
    hangul: char,
) -> Option<(ImageBuffer<Rgb<u8>, Vec<u8>>, ImageBuffer<Rgb<u8>, Vec<u8>>)> {
    if !('\u{AC00}'..='\u{D7A3}').contains(&hangul) {
        return None;
    }

    let index = (hangul as u32) - ('\u{AC00}' as u32);
    let row = index / 588;
    let col = index % 588;

    let x = (col * 12) as u32;
    let y = (row * 12) as u32;

    let original = ImageBuffer::from_fn(12, 12, |dx, dy| {
        *img.get_pixel(x + dx, y + dy)
    });

    let mut processed = ImageBuffer::new(4, 12);
    for dy in 0..12 {
        for dx in 0..4 {
            let r = img.get_pixel(x + dx * 3, y + dy)[0];
            let g = img.get_pixel(x + dx * 3 + 1, y + dy)[0];
            let b = img.get_pixel(x + dx * 3 + 2, y + dy)[0];

            let new_r = if r == 0 { 0 } else { 255 };
            let new_g = if g == 0 { 0 } else { 255 };
            let new_b = if b == 0 { 0 } else { 255 };

            processed.put_pixel(dx, dy, Rgb([new_r, new_g, new_b]));
        }
    }

    Some((original, processed))
}

fn convert_all_glyphs(img: &RgbImage) -> RgbImage {
    let (width, height) = img.dimensions();
    let new_width = width / 3;
    let mut new_img = ImageBuffer::new(new_width, height);

    for y in 0..height {
        for x in 0..new_width {
            let x3 = x * 3;
            let r = img.get_pixel(x3, y)[0];
            let g = img.get_pixel(x3 + 1, y)[0];
            let b = img.get_pixel(x3 + 2, y)[0];

            let new_r = if r == 0 { 0 } else { 255 };
            let new_g = if g == 0 { 0 } else { 255 };
            let new_b = if b == 0 { 0 } else { 255 };

            new_img.put_pixel(x, y, Rgb([new_r, new_g, new_b]));
        }
    }

    new_img
}

fn main() {
    let args: Vec<String> = env::args().collect();
    
    let img_path = Path::new("hangul_image.png");

    let img = match image::open(&img_path) {
        Ok(img) => img.to_rgb8(),
        Err(e) => {
            eprintln!("이미지를 열 수 없습니다: {}", e);
            return;
        }
    };

    if args.len() > 1 {
        match args[1].as_str() {
            "--all" => {
                let processed_img = convert_all_glyphs(&img);
                match processed_img.save("all_glyphs_processed.png") {
                    Ok(_) => println!("모든 글리프가 처리되어 'all_glyphs_processed.png'로 저장되었습니다."),
                    Err(e) => eprintln!("이미지 저장 중 오류 발생: {}", e),
                }
            },
            "--char" => {
                if args.len() < 3 {
                    eprintln!("문자를 지정해주세요. 예: cargo run -- --char 가");
                    return;
                }
                let hangul = args[2].chars().next().unwrap();
                process_single_char(&img, hangul);
            },
            "--text" => {
                if args.len() < 3 {
                    eprintln!("텍스트를 지정해주세요. 예: cargo run -- --text '안녕하세요\n반갑습니다'");
                    return;
                }
                let text = args[2..].join(" "); // 모든 인자를 하나의 문자열로 결합
                process_text(&img, &text);
            },
            _ => {
                eprintln!("알 수 없는 옵션입니다. '--all', '--char <문자>' 또는 '--text <텍스트>'를 사용하세요.");
            }
        }
    } else {
        eprintln!("옵션을 지정해주세요. '--all', '--char <문자>' 또는 '--text <텍스트>'");
    }
}

fn process_single_char(img: &RgbImage, hangul: char) {
    match extract_hangul_image(img, hangul) {
        Some((original, processed)) => {
            println!("문자 '{}' 처리 완료", hangul);
            
            let original_filename = format!("{}_original.png", hangul);
            if let Err(e) = original.save(&original_filename) {
                eprintln!("원본 이미지 저장 중 오류 발생: {}", e);
            }

            let processed_filename = format!("{}_processed.png", hangul);
            if let Err(e) = processed.save(&processed_filename) {
                eprintln!("처리된 이미지 저장 중 오류 발생: {}", e);
            }

            let simulated = simulate_subpixel(&processed);
            let simulated_filename = format!("{}_simulated.png", hangul);
            if let Err(e) = simulated.save(&simulated_filename) {
                eprintln!("시뮬레이션 이미지 저장 중 오류 발생: {}", e);
            }

            println!("'{}', '{}' 및 '{}' 파일로 저장됨", original_filename, processed_filename, simulated_filename);
        }
        None => println!("문자 '{}' 처리 실패", hangul),
    }
}

fn process_text(img: &RgbImage, text: &str) {
    let lines: Vec<&str> = text.split('\n').collect();
    let max_width = lines.iter().map(|line| line.chars().count()).max().unwrap_or(0);
    let height = lines.len();

    let mut original_combined = RgbImage::new(12 * max_width as u32, 12 * height as u32);
    let mut processed_combined = RgbImage::new(4 * max_width as u32, 12 * height as u32);

    for (line_idx, line) in lines.iter().enumerate() {
        for (char_idx, hangul) in line.chars().enumerate() {
            if hangul == ' ' {
                continue; // 공백 문자는 건너뜁니다.
            }

            match extract_hangul_image(img, hangul) {
                Some((original, processed)) => {
                    // 원본 이미지 합치기
                    for y in 0..12 {
                        for x in 0..12 {
                            let pixel = original.get_pixel(x, y);
                            original_combined.put_pixel(x + (char_idx as u32 * 12), y + (line_idx as u32 * 12), *pixel);
                        }
                    }

                    // 처리된 이미지 합치기
                    for y in 0..12 {
                        for x in 0..4 {
                            let pixel = processed.get_pixel(x, y);
                            processed_combined.put_pixel(x + (char_idx as u32 * 4), y + (line_idx as u32 * 12), *pixel);
                        }
                    }

                    println!("문자 '{}' 처리 완료", hangul);
                }
                None => println!("문자 '{}' 처리 실패", hangul),
            }
        }
    }

    // 합쳐진 이미지 저장
    let original_filename = "text_original.png";
    if let Err(e) = original_combined.save(original_filename) {
        eprintln!("원본 이미지 저장 중 오류 발생: {}", e);
    }

    let processed_filename = "text_processed.png";
    if let Err(e) = processed_combined.save(processed_filename) {
        eprintln!("처리된 이미지 저장 중 오류 발생: {}", e);
    }

    let simulated = simulate_subpixel(&processed_combined);
    let simulated_filename = "text_simulated.png";
    if let Err(e) = simulated.save(simulated_filename) {
        eprintln!("시뮬레이션 이미지 저장 중 오류 발생: {}", e);
    }

    println!("'{}', '{}' 및 '{}' 파일로 저장됨", original_filename, processed_filename, simulated_filename);
}

fn simulate_subpixel(img: &RgbImage) -> RgbaImage {
    let (width, height) = img.dimensions();
    let scale = 3;
    let new_width = width * scale;
    let new_height = height * scale;

    let mut simulated = RgbaImage::new(new_width, new_height);

    for y in 0..height {
        for x in 0..width {
            let pixel = img.get_pixel(x, y);
            simulated.put_pixel(x * scale, y * scale, Rgba([pixel[0], 0, 0, 255]));
            simulated.put_pixel(x * scale + 1, y * scale, Rgba([0, pixel[1], 0, 255]));
            simulated.put_pixel(x * scale + 2, y * scale, Rgba([0, 0, pixel[2], 255]));
        }
    }

    // 이미지 크기를 2배로 확대
    let enlarged = resize(&simulated, new_width * 3, new_height * 3, FilterType::Lanczos3);

    // 블러 효과 적용
    blur(&enlarged, 1.0)
}