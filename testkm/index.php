<?php
// Function to sanitize input data
function sanitize_input($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data);
    return $data; // No mysqli_real_escape_string needed without database
}

// Function to calculate score for a specific criterion
// This function now accepts an array for input_data for all criteria,
// making it more consistent and flexible.
function calculate_criterion_score($criterion_id, $input_data, $cooperative_type) {
    $score = 0;
    $calculated_value = 0;

    switch ($criterion_id) {
        case 1.1: // อัตราส่วนของสมาชิกที่มีส่วนร่วมในการดำเนินธุรกิจกับสหกรณ์ (ร้อยละ)
            $numerator = (float)$input_data['numerator'];
            $denominator = (float)$input_data['denominator'];
            $calculated_value = ($denominator > 0) ? ($numerator / $denominator) * 100 : 0;
            $percentage = $calculated_value;
            if ($cooperative_type == 'เกษตร' || $cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') {
                if ($percentage > 80) $score = 15;
                elseif ($percentage > 70) $score = 12;
                elseif ($percentage > 60) $score = 9;
                else $score = 6;
            } elseif ($cooperative_type == 'ออมทรัพย์' || $cooperative_type == 'เครดิตยูเนี่ยน' || $cooperative_type == 'ร้านค้า' || $cooperative_type == 'บริการ') {
                if ($percentage > 85) $score = 15;
                elseif ($percentage > 80) $score = 12;
                elseif ($percentage > 70) $score = 9;
                else $score = 6;
            }
            break;
        case 1.2: // ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง
            $raw_value = $input_data['value'];
            if ($cooperative_type == 'ภาคการเกษตร') { // 10 คะแนน
                if ($raw_value == 'จัดสรร 2 ทุน และจ่าย 2 ทุน ทั้ง 2 ปีบัญชี') $score = 10;
                elseif ($raw_value == 'จัดสรร 2 ทุน ทั้ง 2 ปีบัญชี') $score = 7;
                elseif ($raw_value == 'จัดสรร 1 ทุน ทั้ง 2 ปีบัญชี และจ่าย 1 ทุน 1 ปีบัญชี') $score = 4;
                else $score = 0;
            } elseif ($cooperative_type == 'นอกภาคการเกษตร') { // 15 คะแนน
                if ($raw_value == 'จัดสรร 2 ทุน และจ่าย 2 ทุน ทั้ง 2 ปีบัญชี') $score = 15;
                elseif ($raw_value == 'จัดสรร 2 ทุน ทั้ง 2 ปีบัญชี') $score = 10;
                elseif ($raw_value == 'จัดสรร 1 ทุน ทั้ง 2 ปีบัญชี และจ่าย 1 ทุน 1 ปีบัญชี') $score = 5;
                else $score = 0;
            }
            break;
        case 1.3: // จำนวนประเภทธุรกิจที่สหกรณ์ดำเนินงาน
            $num_businesses = (int)$input_data['value'];
            if ($num_businesses == 6) $score = 5;
            elseif ($num_businesses >= 4 && $num_businesses <= 5) $score = 3;
            elseif ($num_businesses >= 2 && $num_businesses <= 3) $score = 1;
            else $score = 0;
            break;
        case 2.1: // อัตราส่วนหนี้สินต่อทุน (เท่า)
            $numerator = (float)$input_data['numerator'];
            $denominator = (float)$input_data['denominator'];
            $calculated_value = ($denominator > 0) ? ($numerator / $denominator) : 0;
            $ratio = $calculated_value;
            if ($cooperative_type == 'เกษตร' || $cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') {
                if ($ratio < 0.75) $score = 3;
                elseif ($ratio >= 0.75 && $ratio <= 1.75) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'ออมทรัพย์' || $cooperative_type == 'เครดิตยูเนี่ยน' || $cooperative_type == 'ร้านค้า') {
                if ($ratio < 0.50) $score = 3;
                elseif ($ratio >= 0.50 && $ratio <= 1.00) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'บริการ') {
                if ($ratio < 0.50) $score = 3;
                elseif ($ratio >= 0.50 && $ratio <= 1.50) $score = 2;
                else $score = 1;
            }
            break;
        case 2.2: // อัตราส่วนทุนสำรองต่อสินทรัพย์ (เท่า)
            $numerator = (float)$input_data['numerator'];
            $denominator = (float)$input_data['denominator'];
            $calculated_value = ($denominator > 0) ? ($numerator / $denominator) : 0;
            $ratio = $calculated_value;
            if ($cooperative_type == 'เกษตร') {
                if ($ratio > 0.20) $score = 2;
                elseif ($ratio >= 0.10 && $ratio <= 0.20) $score = 1;
                else $score = 0;
            } elseif ($cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') {
                if ($ratio > 0.25) $score = 2;
                elseif ($ratio >= 0.15 && $ratio <= 0.25) $score = 1;
                else $score = 0;
            } elseif ($cooperative_type == 'ออมทรัพย์') {
                if ($ratio > 0.10) $score = 2;
                elseif ($ratio >= 0.04 && $ratio <= 0.10) $score = 1;
                else $score = 0;
            } elseif ($cooperative_type == 'เครดิตยูเนี่ยน') {
                if ($ratio > 0.11) $score = 2;
                elseif ($ratio >= 0.05 && $ratio <= 0.11) $score = 1;
                else $score = 0;
            } elseif ($cooperative_type == 'ร้านค้า' || $cooperative_type == 'บริการ') {
                if ($ratio > 0.25) $score = 2;
                elseif ($ratio >= 0.15 && $ratio >= 0.25) $score = 1;
                else $score = 0;
            }
            break;
        case 2.3: // อัตราผลตอบแทนต่อสินทรัพย์ (ร้อยละ)
            $profit = (float)$input_data['numerator']; // กำไรสุทธิ
            $previous_year_asset = (float)$input_data['previous_year_asset'];
            $current_year_asset = (float)$input_data['current_year_asset'];
            $average_asset = (($previous_year_asset + $current_year_asset) > 0) ? (($previous_year_asset + $current_year_asset) / 2) : 0;
            $calculated_value = ($average_asset > 0) ? ($profit / $average_asset) * 100 : 0;
            $percentage = $calculated_value;
            if ($cooperative_type == 'เกษตร' || $cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') {
                if ($percentage > 3.00) $score = 4;
                elseif ($percentage >= 1.50 && $percentage <= 3.00) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'ออมทรัพย์' || $cooperative_type == 'เครดิตยูเนี่ยน') {
                if ($percentage > 4.00) $score = 4;
                elseif ($percentage >= 2.00 && $percentage <= 4.00) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'ร้านค้า') {
                if ($percentage > 8.00) $score = 4;
                elseif ($percentage >= 4.00 && $percentage <= 8.00) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'บริการ') {
                if ($percentage > 5.00) $score = 4;
                elseif ($percentage >= 2.50 && $percentage <= 5.00) $score = 2;
                else $score = 1;
            }
            break;
        case 2.4: // อัตราค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่ายดำเนินงาน (ร้อยละ)
            $numerator = (float)$input_data['numerator'];
            $denominator = (float)$input_data['denominator'];
            $calculated_value = ($denominator > 0) ? ($numerator / $denominator) * 100 : 0;
            $percentage = $calculated_value;
            if ($cooperative_type == 'เกษตร') {
                if ($percentage < 45) $score = 4;
                elseif ($percentage >= 45 && $percentage <= 65) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') {
                if ($percentage < 50) $score = 4;
                elseif ($percentage >= 50 && $percentage <= 70) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'ออมทรัพย์') {
                if ($percentage < 25) $score = 4;
                elseif ($percentage >= 25 && $percentage <= 35) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'เครดิตยูเนี่ยน') {
                if ($percentage < 40) $score = 4;
                elseif ($percentage >= 40 && $percentage <= 60) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'ร้านค้า' || $cooperative_type == 'บริการ') {
                if ($percentage < 50) $score = 4;
                elseif ($percentage >= 50 && $percentage <= 70) $score = 2;
                else $score = 1;
            }
            break;
        case 2.5: // อัตราส่วนทุนหมุนเวียน (เท่า)
            $numerator = (float)$input_data['numerator'];
            $denominator = (float)$input_data['denominator'];
            $calculated_value = ($denominator > 0) ? ($numerator / $denominator) : 0;
            $ratio = $calculated_value;
            if ($cooperative_type == 'เกษตร' || $cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') {
                if ($ratio > 1.75) $score = 3;
                elseif ($ratio >= 0.75 && $ratio <= 1.75) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'ออมทรัพย์' || $cooperative_type == 'เครดิตยูเนี่ยน' || $cooperative_type == 'ร้านค้า') {
                if ($ratio > 1.00) $score = 3;
                elseif ($ratio >= 0.50 && $ratio <= 1.00) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'บริการ') {
                if ($ratio > 1.50) $score = 3;
                elseif ($ratio >= 0.50 && $ratio <= 1.50) $score = 2;
                else $score = 1;
            }
            break;
        case 2.6: // อัตราลูกหนี้ระยะสั้นที่ชำระหนี้ได้ตามกำหนด (ร้อยละ)
            if ($input_data['method'] == 'calculate') {
                $numerator = (float)$input_data['numerator'];
                $denominator = (float)$input_data['denominator'];
                $calculated_value = ($denominator > 0) ? ($numerator / $denominator) * 100 : 0;
            } elseif ($input_data['method'] == 'direct') {
                $calculated_value = (float)$input_data['percentage'];
            } else {
                $calculated_value = 0; // Default or error
            }
            $percentage = $calculated_value;
            if ($cooperative_type == 'เกษตร' || $cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') {
                if ($percentage > 90) $score = 4;
                elseif ($percentage >= 60 && $percentage <= 90) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'ออมทรัพย์' || $cooperative_type == 'เครดิตยูเนี่ยน') {
                if ($percentage > 95) $score = 4;
                elseif ($percentage >= 85 && $percentage <= 95) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'ร้านค้า') {
                if ($percentage > 95) $score = 4;
                elseif ($percentage >= 85 && $percentage <= 95) $score = 2;
                else $score = 1;
            } elseif ($cooperative_type == 'บริการ') {
                if ($percentage > 90) $score = 4;
                elseif ($percentage >= 60 && $percentage <= 90) $score = 2;
                else $score = 1;
            }
            break;
        case 3.1: // การใช้เทคโนโลยีการบัญชีในการบริหารจัดการ
            $raw_value = $input_data['value'];
            if ($raw_value == 'ใช้งานเต็มระบบ') $score = 4;
            elseif ($raw_value == 'ใช้งานบางส่วน') $score = 2;
            else $score = 0;
            break;
        case 3.2: // สภาพแวดล้อมการควบคุม
        case 3.3: // ความเสี่ยงและกิจกรรมควบคุม
        case 3.4: // ระบบข้อมูลสารสนเทศและการสื่อสาร
        case 3.5: // ระบบการติดตามและประเมินผล
            $raw_value = $input_data['value'];
            if ($raw_value == 'ดีมาก') $score = 4;
            elseif ($raw_value == 'ดี') $score = 3;
            elseif ($raw_value == 'พอใช้') $score = 2;
            else $score = 0;
            break;
        case 4.1: // ผลการดำเนินงานของสหกรณ์ต้องไม่มีการฝ่าฝืนระเบียบ คำสั่งนายทะเบียน ข้อกฎหมาย
            $raw_value = $input_data['value'];
            if ($raw_value == 'ไม่มีข้อบกพร่อง/แก้ไขแล้วเสร็จสมบูรณ์') $score = 15;
            elseif ($raw_value == 'เสร็จต้องติดตาม') $score = 10;
            elseif ($raw_value == 'อยู่ระหว่างดำเนินการแก้ไข') $score = 5;
            else $score = 0;
            break;
        case 4.2: // ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง สหกรณ์มีผลการดำเนินงานไม่ขาดทุน
            $raw_value = $input_data['value'];
            if ($raw_value == 'กำไรทั้งสองปี') $score = 5;
            elseif ($raw_value == 'ขาดทุนปีแรก กำไรปีสอง') $score = 3;
            elseif ($raw_value == 'กำไรปีแรก ขาดทุนปีสอง' || $raw_value == 'ขาดทุนเพราะมีข้อยกเว้น') $score = 1;
            else $score = 0;
            break;
        case 4.3: // สหกรณ์จัดทำงบการเงินแล้วเสร็จ
            $raw_value = $input_data['value'];
            if ($raw_value == 'ภายใน 30 วัน') $score = 5;
            elseif ($raw_value == 'ภายใน 60 วัน') $score = 4;
            elseif ($raw_value == 'ภายใน 90 วัน') $score = 2;
            else $score = 0;
            break;
        case 4.4: // สหกรณ์จัดจ้างเจ้าหน้าที่ปฏิบัติงานประจำ
            $raw_value = $input_data['value'];
            if ($raw_value == 'จัดจ้างประจำ') $score = 5;
            elseif ($raw_value == 'จัดจ้างชั่วคราว') $score = 3;
            elseif ($raw_value == 'คำสั่งมอบหมาย') $score = 2;
            else $score = 0;
            break;
        default:
            $score = 0; // Unknown criterion
            break;
    }
    return $score;
}

// Function to calculate dimension score
function calculate_dimension_score($dimension_id, $criterion_scores, $cooperative_type) {
    $total_score = 0;
    foreach ($criterion_scores as $criterion_id_key => $score) {
        if (floor((float)$criterion_id_key) == $dimension_id) {
            $total_score += $score;
        }
    }
    return $total_score;
}

// Function to determine strength level based on overall score and additional conditions
function get_strength_level($overall_score, $cooperative_type, $basic_conditions_met, $is_overall_control_assessment, $dimension2_score, $dimension3_score, $criterion_4_1_score, $criterion_4_2_score, $criterion_4_3_score, $cannot_close_accounts_3_years) {
    $strength_level = "ระดับ 3 (ต้องปรับปรุง)"; // Default to lowest class if not met higher criteria

    // Handle "ปิดบัญชีไม่ได้ต่อเนื่องตั้งแต่ 3 ปีบัญชีขึ้นไป" first, as it forces ชั้น 3
    if ($cannot_close_accounts_3_years) {
        return "ระดับ 3 (ต้องปรับปรุง)";
    }

    // Handle "สหกรณ์ที่ประเมินการควบคุมภายในแบบภาพรวม การจัดชั้นสูงสุดจะอยู่ที่ ชั้น 2"
    if ($is_overall_control_assessment) {
        if ($overall_score >= 65) {
            return "ระดับ 2 (เข้มแข็ง)";
        } else {
            return "ระดับ 3 (พอใช้)";
        }
    }

    // Apply specific rules based on cooperative type
    if ($cooperative_type == 'เกษตร' || $cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') { // สหกรณ์ภาคการเกษตร
        // ชั้น 1
        if ($basic_conditions_met && $overall_score >= 80 && $criterion_4_1_score == 15 && $criterion_4_2_score == 5) {
            $strength_level = "ระดับ 1 (เข้มแข็งมาก)";
        }
        // ชั้น 2
        elseif ($overall_score >= 55 && $overall_score < 80 && $criterion_4_1_score == 10 && $criterion_4_2_score == 3) {
            $strength_level = "ระดับ 2 (เข้มแข็ง)";
        }
        // ชั้น 3 (default if not ชั้น 1 or ชั้น 2)
        else {
            $strength_level = "ระดับ 3 (พอใช้)";
        }
    } elseif ($cooperative_type == 'ออมทรัพย์' || $cooperative_type == 'เครดิตยูเนี่ยน' || $cooperative_type == 'ร้านค้า' || $cooperative_type == 'บริการ') { // สหกรณ์นอกภาคการเกษตร
        // ชั้น 1
        if ($basic_conditions_met && $overall_score >= 80 && $criterion_4_1_score == 15 && $criterion_4_2_score == 5 && $dimension3_score > 0) {
            $strength_level = "ระดับ 1 (เข้มแข็งมาก)";
        }
        // ชั้น 2
        elseif ($overall_score >= 65 && $overall_score < 80 && $criterion_4_1_score == 10 && $criterion_4_2_score == 3) {
            $strength_level = "ระดับ 2 (เข้มแข็ง)";
        }
        // ชั้น 3 (default if not ชั้น 1 or ชั้น 2)
        else {
            $strength_level = "ระดับ 3 (พอใช้)";
        }
    } elseif ($cooperative_type == 'กลุ่มเกษตรกร') { // กลุ่มเกษตรกร
        // ชั้น 1
        if ($basic_conditions_met && $overall_score >= 85 && $criterion_4_1_score == 15 && $criterion_4_3_score == 5 && $dimension2_score >= 16) {
            $strength_level = "ระดับ 1 (เข้มแข็งมาก)";
        }
        // ชั้น 2
        elseif ($overall_score >= 65 && $overall_score < 85 && $criterion_4_1_score == 10 && $criterion_4_3_score == 4) {
            $strength_level = "ระดับ 2 (เข้มแข็ง)";
        }
        // ชั้น 3 (default if not ชั้น 1 or ชั้น 2)
        else {
            $strength_level = "ระดับ 3 (พอใช้)";
        }
    }

    // Final check for ชั้น 3 conditions if not already assigned a higher class
    if ($strength_level == "ระดับ 3 (พอใช้)") {
        if (!$basic_conditions_met ||
            (($cooperative_type == 'เกษตร' || $cooperative_type == 'นิคม' || $cooperative_type == 'ประมง') && $overall_score < 55) ||
            (($cooperative_type == 'ออมทรัพย์' || $cooperative_type == 'เครดิตยูเนี่ยน' || $cooperative_type == 'ร้านค้า' || $cooperative_type == 'บริการ') && $overall_score < 65) ||
            ($cooperative_type == 'กลุ่มเกษตรกร' && $overall_score < 65)
        ) {
            $strength_level = "ระดับ 3 (ต้องปรับปรุง)";
        }
    }

    return $strength_level;
}

// Define maximum scores for each dimension for charting purposes
$max_dimension_scores = [
    1 => 30, // มิติที่ 1: ความสามารถในการให้บริการสมาชิก
    2 => 20, // มิติที่ 2: ประสิทธิภาพในการดำเนินธุรกิจ
    3 => 20, // มิติที่ 3: ประสิทธิภาพในการจัดการองค์กร
    4 => 30  // มิติที่ 4: ประสิทธิภาพของการบริหารงาน
];

// Map criterion IDs to their Thai descriptions for display
$criterion_descriptions = [
    '1.1' => 'อัตราส่วนของสมาชิกที่มีส่วนร่วมในการดำเนินธุรกิจกับสหกรณ์',
    '1.2' => 'ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง',
    '1.3' => 'จำนวนประเภทธุรกิจที่สหกรณ์ดำเนินงาน',
    '2.1' => 'อัตราส่วนหนี้สินต่อทุน',
    '2.2' => 'อัตราส่วนทุนสำรองต่อสินทรัพย์',
    '2.3' => 'อัตราผลตอบแทนต่อสินทรัพย์',
    '2.4' => 'อัตราค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่ายดำเนินงาน',
    '2.5' => 'อัตราส่วนทุนหมุนเวียน',
    '2.6' => 'อัตราลูกหนี้ระยะสั้นที่ชำระหนี้ได้ตามกำหนด',
    '3.1' => 'การใช้เทคโนโลยีการบัญชีในการบริหารจัดการ',
    '3.2' => 'สภาพแวดล้อมการควบคุม',
    '3.3' => 'ความเสี่ยงและกิจกรรมควบคุม',
    '3.4' => 'ระบบข้อมูลสารสนเทศและการสื่อสาร',
    '3.5' => 'ระบบการติดตามและประเมินผล',
    '4.1' => 'ผลการดำเนินงานของสหกรณ์ต้องไม่มีการฝ่าฝืนระเบียบ คำสั่งนายทะเบียน ข้อกฎหมาย',
    '4.2' => 'ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง สหกรณ์มีผลการดำเนินงานไม่ขาดทุน',
    '4.3' => 'สหกรณ์จัดทำงบการเงินแล้วเสร็จ',
    '4.4' => 'สหกรณ์จัดจ้างเจ้าหน้าที่ปฏิบัติงานประจำ'
];


// --- HTML Structure for the Assessment Form ---
?>


<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ระบบประเมินความเข้มแข็งสหกรณ์</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        .container {
            max-width: 900px;
            margin: 2rem auto;
            padding: 2rem;
            background-color: #ffffff;
            border-radius: 1rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        h1, h2 {
            color: #1a202c;
            font-weight: 600;
        }
        .form-group label {
            font-weight: 500;
            color: #4a5568;
        }
        .btn-primary {
            background-color: #4c51bf;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            transition: background-color 0.2s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .btn-primary:hover {
            background-color: #5a67d8;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        .btn-secondary {
            background-color: #6b7280;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            transition: background-color 0.2s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .btn-secondary:hover {
            background-color: #4b5563;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        .alert {
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
            font-weight: 600;
        }
        .alert-success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .alert-error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .result-box {
            background-color: #e0f2fe;
            border: 1px solid #90cdf4;
            padding: 1.5rem;
            border-radius: 0.75rem;
            margin-top: 2rem;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .result-item {
            margin-bottom: 0.5rem;
        }
        .result-item strong {
            color: #2b6cb0;
        }
        .input-pair {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap; /* Allow wrapping on smaller screens */
        }
        .input-pair input {
            flex: 1;
            min-width: 120px; /* Ensure inputs don't become too small */
        }
        .input-pair .sub-label {
            font-size: 0.875rem; /* text-sm */
            color: #4a5568; /* text-gray-700 */
            min-width: 80px; /* Adjust as needed for alignment */
            text-align: right;
        }
        .radio-option {
            display: flex;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .radio-option input[type="radio"] {
            margin-right: 0.5rem;
        }
        .score-display {
            font-size: 2.5rem; /* Larger font for overall score */
            font-weight: 700;
            color: #1a202c;
            text-align: center;
            margin-top: 1rem;
            margin-bottom: 1rem;
        }
        .strength-level-display {
            font-size: 2rem; /* Larger font for strength level */
            font-weight: 700;
            text-align: center;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
        }
        .strength-level-display .icon {
            font-size: 1.8rem;
        }
        .chart-container {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #cbd5e0;
        }
        .chart-bar-wrapper {
            display: flex;
            align-items: center;
            margin-bottom: 0.75rem;
        }
        .chart-label {
            width: 120px;
            font-size: 0.9rem;
            font-weight: 500;
            color: #4a5568;
            flex-shrink: 0;
        }
        .chart-bar {
            flex-grow: 1;
            height: 25px;
            background-color: #63b3ed;
            border-radius: 0.25rem;
            margin-left: 1rem;
            position: relative;
            overflow: hidden;
        }
        .chart-bar-fill {
            height: 100%;
            background-color: #3182ce;
            border-radius: 0.25rem;
            transition: width 0.5s ease-out;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 0.5rem;
            color: white;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .bar-score-text {
             position: absolute;
             right: 0.5rem;
             color: white;
             font-size: 0.8rem;
             font-weight: 600;
             text-shadow: 1px 1px 2px rgba(0,0,0,0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="text-3xl text-center mb-6">ระบบประเมินความเข้มแข็งสหกรณ์</h1>

        <?php
        // Handle form submission
        if ($_SERVER["REQUEST_METHOD"] == "POST") {
            $cooperative_name = sanitize_input($_POST['cooperative_name']);
            $cooperative_type = sanitize_input($_POST['cooperative_type']);
            $assessment_date = sanitize_input($_POST['assessment_date']);
            $assessed_by = sanitize_input($_POST['assessed_by']);

            // Basic Conditions
            $basic_condition_close_account = isset($_POST['basic_condition_close_account']) ? true : false;
            $basic_condition_general_meeting = isset($_POST['basic_condition_general_meeting']) ? true : false;
            $basic_condition_approve_financial = isset($_POST['basic_condition_approve_financial']) ? true : false;
            $basic_conditions_met = $basic_condition_close_account && $basic_condition_general_meeting && $basic_condition_approve_financial;

            // Overall Control Assessment Flag
            $is_overall_control_assessment = isset($_POST['is_overall_control_assessment']) ? true : false;

            // Cannot close accounts for 3 consecutive years or more
            $cannot_close_accounts_3_years = isset($_POST['cannot_close_accounts_3_years']) ? true : false;


            // Collect raw values for each criterion
            $criterion_raw_values = [];

            // Special handling for ratio/percentage inputs
            $criterion_1_1_numerator = sanitize_input($_POST['criterion_1_1_numerator']);
            $criterion_1_1_denominator = sanitize_input($_POST['criterion_1_1_denominator']);
            $criterion_raw_values['1.1'] = [
                'numerator' => $criterion_1_1_numerator,
                'denominator' => $criterion_1_1_denominator
            ];

            $criterion_2_1_numerator = sanitize_input($_POST['criterion_2_1_numerator']);
            $criterion_2_1_denominator = sanitize_input($_POST['criterion_2_1_denominator']);
            $criterion_raw_values['2.1'] = [
                'numerator' => $criterion_2_1_numerator,
                'denominator' => $criterion_2_1_denominator
            ];

            $criterion_2_2_numerator = sanitize_input($_POST['criterion_2_2_numerator']);
            $criterion_2_2_denominator = sanitize_input($_POST['criterion_2_2_denominator']);
            $criterion_raw_values['2.2'] = [
                'numerator' => $criterion_2_2_numerator,
                'denominator' => $criterion_2_2_denominator
            ];

            // For 2.3, collect profit and previous/current year assets
            $criterion_2_3_numerator = sanitize_input($_POST['criterion_2_3_numerator']); // กำไรสุทธิ
            $criterion_2_3_previous_year_asset = sanitize_input($_POST['criterion_2_3_previous_year_asset']);
            $criterion_2_3_current_year_asset = sanitize_input($_POST['criterion_2_3_current_year_asset']);
            $criterion_raw_values['2.3'] = [
                'numerator' => $criterion_2_3_numerator,
                'previous_year_asset' => $criterion_2_3_previous_year_asset,
                'current_year_asset' => $criterion_2_3_current_year_asset
            ];

            $criterion_2_4_numerator = sanitize_input($_POST['criterion_2_4_numerator']);
            $criterion_2_4_denominator = sanitize_input($_POST['criterion_2_4_denominator']);
            $criterion_raw_values['2.4'] = [
                'numerator' => $criterion_2_4_numerator,
                'denominator' => $criterion_2_4_denominator
            ];

            $criterion_2_5_numerator = sanitize_input($_POST['criterion_2_5_numerator']);
            $criterion_2_5_denominator = sanitize_input($_POST['criterion_2_5_denominator']);
            $criterion_raw_values['2.5'] = [
                'numerator' => $criterion_2_5_numerator,
                'denominator' => $criterion_2_5_denominator
            ];

            // For 2.6, handle the input method
            $criterion_2_6_method = sanitize_input($_POST['criterion_2_6_input_method']);
            $criterion_2_6_numerator = '';
            $criterion_2_6_denominator = '';
            $criterion_2_6_direct_percentage = '';

            if ($criterion_2_6_method == 'calculate') {
                $criterion_2_6_numerator = sanitize_input($_POST['criterion_2_6_numerator']);
                $criterion_2_6_denominator = sanitize_input($_POST['criterion_2_6_denominator']);
                $criterion_raw_values['2.6'] = [
                    'method' => 'calculate',
                    'numerator' => $criterion_2_6_numerator,
                    'denominator' => $criterion_2_6_denominator
                ];
            } elseif ($criterion_2_6_method == 'direct') {
                $criterion_2_6_direct_percentage = sanitize_input($_POST['criterion_2_6_direct_percentage']);
                $criterion_raw_values['2.6'] = [
                    'method' => 'direct',
                    'percentage' => $criterion_2_6_direct_percentage
                ];
            } else {
                $criterion_raw_values['2.6'] = ['method' => 'none', 'percentage' => 0]; // Default or error handling
            }


            // For select/number inputs, wrap in 'value' key
            $criterion_1_2_value = sanitize_input($_POST['criterion_1_2']);
            $criterion_raw_values['1.2'] = ['value' => $criterion_1_2_value];

            $criterion_1_3_value = sanitize_input($_POST['criterion_1_3']);
            $criterion_raw_values['1.3'] = ['value' => $criterion_1_3_value];

            $criterion_3_1_value = sanitize_input($_POST['criterion_3_1']);
            $criterion_raw_values['3.1'] = ['value' => $criterion_3_1_value];

            $criterion_3_2_value = sanitize_input($_POST['criterion_3_2']);
            $criterion_raw_values['3.2'] = ['value' => $criterion_3_2_value];

            $criterion_3_3_value = sanitize_input($_POST['criterion_3_3']);
            $criterion_raw_values['3.3'] = ['value' => $criterion_3_3_value];

            $criterion_3_4_value = sanitize_input($_POST['criterion_3_4']);
            $criterion_raw_values['3.4'] = ['value' => $criterion_3_4_value];

            $criterion_3_5_value = sanitize_input($_POST['criterion_3_5']);
            $criterion_raw_values['3.5'] = ['value' => $criterion_3_5_value];

            $criterion_4_1_value = sanitize_input($_POST['criterion_4_1']);
            $criterion_raw_values['4.1'] = ['value' => $criterion_4_1_value];

            $criterion_4_2_value = sanitize_input($_POST['criterion_4_2']);
            $criterion_raw_values['4.2'] = ['value' => $criterion_4_2_value];

            $criterion_4_3_value = sanitize_input($_POST['criterion_4_3']);
            $criterion_raw_values['4.3'] = ['value' => $criterion_4_3_value];

            $criterion_4_4_value = sanitize_input($_POST['criterion_4_4']);
            $criterion_raw_values['4.4'] = ['value' => $criterion_4_4_value];


            // Calculate scores for each criterion
            $criterion_calculated_scores = [];
            foreach ($criterion_raw_values as $id => $raw_value) {
                $criterion_calculated_scores[$id] = calculate_criterion_score((float)$id, $raw_value, $cooperative_type);
            }

            // Calculate dimension scores
            $dimension1_score = calculate_dimension_score(1, $criterion_calculated_scores, $cooperative_type);
            $dimension2_score = calculate_dimension_score(2, $criterion_calculated_scores, $cooperative_type);
            $dimension3_score = calculate_dimension_score(3, $criterion_calculated_scores, $cooperative_type);
            $dimension4_score = calculate_dimension_score(4, $criterion_calculated_scores, $cooperative_type);

            // Calculate overall score (sum of dimension scores)
            $overall_score = $dimension1_score + $dimension2_score + $dimension3_score + $dimension4_score;

            // Get specific criterion scores needed for strength level determination
            $criterion_4_1_score = $criterion_calculated_scores['4.1'] ?? 0;
            $criterion_4_2_score = $criterion_calculated_scores['4.2'] ?? 0;
            $criterion_4_3_score = $criterion_calculated_scores['4.3'] ?? 0; // For Farmer Groups special condition

            // Determine strength level
            $strength_level = get_strength_level(
                $overall_score,
                $cooperative_type,
                $basic_conditions_met,
                $is_overall_control_assessment,
                $dimension2_score,
                $dimension3_score,
                $criterion_4_1_score,
                $criterion_4_2_score,
                $criterion_4_3_score,
                $cannot_close_accounts_3_years
            );

            // Determine icon for strength level
            $strength_icon = '';
            $strength_color = '';
            if (strpos($strength_level, 'ระดับ 1') !== false) {
                $strength_icon = '<i class="fas fa-star text-yellow-500 icon"></i>';
                $strength_color = 'text-green-700';
            } elseif (strpos($strength_level, 'ระดับ 2') !== false) {
                $strength_icon = '<i class="fas fa-check-circle text-blue-500 icon"></i>';
                $strength_color = 'text-blue-700';
            } else {
                $strength_icon = '<i class="fas fa-exclamation-triangle text-red-500 icon"></i>';
                $strength_color = 'text-red-700';
            }


            // Display results
            echo "<div class='result-box'>";
            echo "<h2 class='text-2xl mb-4 text-center'>ผลการประเมินความเข้มแข็งสหกรณ์</h2>";
            echo "<div class='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>";
            echo "<div class='result-item'><strong>ชื่อสหกรณ์:</strong> " . $cooperative_name . "</div>";
            echo "<div class='result-item'><strong>ประเภทสหกรณ์:</strong> " . $cooperative_type . "</div>";
            echo "<div class='result-item'><strong>วันที่ประเมิน:</strong> " . $assessment_date . "</div>";
            echo "<div class='result-item'><strong>ผู้ประเมิน:</strong> " . $assessed_by . "</div>";
            echo "</div>"; // End grid

            // Display basic conditions
            echo "<h3 class='text-xl font-semibold mt-6 mb-2'>เงื่อนไขพื้นฐานที่กรอก:</h3>";
            echo "<div class='grid grid-cols-1 md:grid-cols-2 gap-2 mb-4'>";
            echo "<div class='result-item'><strong>ปีที่ประเมินปิดบัญชีได้:</strong> " . ($basic_condition_close_account ? 'ใช่' : 'ไม่ใช่') . "</div>";
            echo "<div class='result-item'><strong>ประชุมใหญ่ได้:</strong> " . ($basic_condition_general_meeting ? 'ใช่' : 'ไม่ใช่') . "</div>";
            echo "<div class='result-item'><strong>ประชุมใหญ่และอนุมัติงบการเงินได้:</strong> " . ($basic_condition_approve_financial ? 'ใช่' : 'ไม่ใช่') . "</div>";
            echo "<div class='result-item'><strong>ปิดบัญชีไม่ได้ต่อเนื่อง 3 ปีขึ้นไป:</strong> " . ($cannot_close_accounts_3_years ? 'ใช่' : 'ไม่ใช่') . "</div>";
            echo "<div class='result-item'><strong>ประเมินการควบคุมภายในแบบภาพรวม:</strong> " . ($is_overall_control_assessment ? 'ใช่' : 'ไม่ใช่') . "</div>";
            echo "</div>";

            // Display raw inputs for each dimension
            echo "<h3 class='text-xl font-semibold mt-6 mb-2'>ข้อมูลที่กรอก (มิติที่ 1: ความสามารถในการให้บริการสมาชิก):</h3>";
            echo "<div class='grid grid-cols-1 md:grid-cols-2 gap-2 mb-4'>";
            echo "<div class='result-item'><strong>1.1 จำนวนสมาชิกที่ร่วมธุรกิจ:</strong> " . $criterion_1_1_numerator . "</div>";
            echo "<div class='result-item'><strong>1.1 จำนวนสมาชิกทั้งหมด:</strong> " . $criterion_1_1_denominator . "</div>";
            echo "<div class='result-item'><strong>1.2 ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง:</strong> " . $criterion_1_2_value . "</div>";
            echo "<div class='result-item'><strong>1.3 จำนวนประเภทธุรกิจที่สหกรณ์ดำเนินงาน:</strong> " . $criterion_1_3_value . "</div>";
            echo "</div>";

            echo "<h3 class='text-xl font-semibold mt-6 mb-2'>ข้อมูลที่กรอก (มิติที่ 2: ประสิทธิภาพในการดำเนินธุรกิจ):</h3>";
            echo "<div class='grid grid-cols-1 md:grid-cols-2 gap-2 mb-4'>";
            echo "<div class='result-item'><strong>2.1 หนี้สินรวม:</strong> " . $criterion_2_1_numerator . "</div>";
            echo "<div class='result-item'><strong>2.1 ทุนรวม:</strong> " . $criterion_2_1_denominator . "</div>";
            echo "<div class='result-item'><strong>2.2 ทุนสำรอง:</strong> " . $criterion_2_2_numerator . "</div>";
            echo "<div class='result-item'><strong>2.2 สินทรัพย์รวม:</strong> " . $criterion_2_2_denominator . "</div>";
            echo "<div class='result-item'><strong>2.3 กำไรสุทธิ:</strong> " . $criterion_2_3_numerator . "</div>";
            echo "<div class='result-item'><strong>2.3 สินทรัพย์รวมปีก่อน:</strong> " . $criterion_2_3_previous_year_asset . "</div>";
            echo "<div class='result-item'><strong>2.3 สินทรัพย์รวมปีปัจจุบัน:</strong> " . $criterion_2_3_current_year_asset . "</div>";
            echo "<div class='result-item'><strong>2.4 ค่าใช้จ่ายดำเนินงาน:</strong> " . $criterion_2_4_numerator . "</div>";
            echo "<div class='result-item'><strong>2.4 กำไรก่อนหักค่าใช้จ่ายดำเนินงาน:</strong> " . $criterion_2_4_denominator . "</div>";
            echo "<div class='result-item'><strong>2.5 สินทรัพย์หมุนเวียน:</strong> " . $criterion_2_5_numerator . "</div>";
            echo "<div class='result-item'><strong>2.5 หนี้สินหมุนเวียน:</strong> " . $criterion_2_5_denominator . "</div>";
            echo "<div class='result-item'><strong>2.6 วิธีการกรอก:</strong> " . ($criterion_2_6_method == 'calculate' ? 'คำนวณจากข้อมูล' : 'ระบุค่าร้อยละโดยตรง') . "</div>";
            if ($criterion_2_6_method == 'calculate') {
                echo "<div class='result-item'><strong>2.6 ลูกหนี้ที่ชำระได้:</strong> " . $criterion_2_6_numerator . "</div>";
                echo "<div class='result-item'><strong>2.6 ลูกหนี้ระยะสั้นทั้งหมด:</strong> " . $criterion_2_6_denominator . "</div>";
            } else {
                echo "<div class='result-item'><strong>2.6 ค่าร้อยละ:</strong> " . $criterion_2_6_direct_percentage . "%</div>";
            }
            echo "</div>";

            echo "<h3 class='text-xl font-semibold mt-6 mb-2'>ข้อมูลที่กรอก (มิติที่ 3: ประสิทธิภาพในการจัดการองค์กร):</h3>";
            echo "<div class='grid grid-cols-1 md:grid-cols-2 gap-2 mb-4'>";
            echo "<div class='result-item'><strong>3.1 การใช้เทคโนโลยีการบัญชี:</strong> " . $criterion_3_1_value . "</div>";
            echo "<div class='result-item'><strong>3.2 สภาพแวดล้อมการควบคุม:</strong> " . $criterion_3_2_value . "</div>";
            echo "<div class='result-item'><strong>3.3 ความเสี่ยงและกิจกรรมควบคุม:</strong> " . $criterion_3_3_value . "</div>";
            echo "<div class='result-item'><strong>3.4 ระบบข้อมูลสารสนเทศและการสื่อสาร:</strong> " . $criterion_3_4_value . "</div>";
            echo "<div class='result-item'><strong>3.5 ระบบการติดตามและประเมินผล:</strong> " . $criterion_3_5_value . "</div>";
            echo "</div>";

            echo "<h3 class='text-xl font-semibold mt-6 mb-2'>ข้อมูลที่กรอก (มิติที่ 4: ประสิทธิภาพของการบริหารงาน):</h3>";
            echo "<div class='grid grid-cols-1 md:grid-cols-2 gap-2 mb-4'>";
            echo "<div class='result-item'><strong>4.1 ผลการดำเนินงานไม่มีการฝ่าฝืนระเบียบ:</strong> " . $criterion_4_1_value . "</div>";
            echo "<div class='result-item'><strong>4.2 ผลการดำเนินงานไม่ขาดทุน:</strong> " . $criterion_4_2_value . "</div>";
            echo "<div class='result-item'><strong>4.3 จัดทำงบการเงินแล้วเสร็จ:</strong> " . $criterion_4_3_value . "</div>";
            echo "<div class='result-item'><strong>4.4 จัดจ้างเจ้าหน้าที่ปฏิบัติงานประจำ:</strong> " . $criterion_4_4_value . "</div>";
            echo "</div>";


            echo "<div class='score-display'>" . number_format($overall_score, 2) . " คะแนน</div>";
            echo "<div class='strength-level-display " . $strength_color . "'>" . $strength_icon . $strength_level . "</div>";

            echo "<div class='chart-container'>";
            echo "<h3 class='text-xl font-semibold mb-4 text-center'>คะแนนแยกตามมิติ</h3>";

            $dimension_scores_for_chart = [
                'มิติที่ 1 (ความสามารถในการให้บริการสมาชิก)' => $dimension1_score,
                'มิติที่ 2 (ประสิทธิภาพในการดำเนินธุรกิจ)' => $dimension2_score,
                'มิติที่ 3 (ประสิทธิภาพในการจัดการองค์กร)' => $dimension3_score,
                'มิติที่ 4 (ประสิทธิภาพของการบริหารงาน)' => $dimension4_score
            ];

            foreach ($dimension_scores_for_chart as $label => $score) {
                $dimension_id_for_chart = substr($label, strpos($label, 'ที่ ') + 3, 1); // Extract 1, 2, 3, 4
                $max_score_for_dimension = $max_dimension_scores[(int)$dimension_id_for_chart];
                $percentage_of_max = ($max_score_for_dimension > 0) ? ($score / $max_score_for_dimension) * 100 : 0;
                $bar_width = min(100, max(0, $percentage_of_max)); // Ensure width is between 0 and 100
                echo "<div class='chart-bar-wrapper'>";
                echo "<div class='chart-label'>" . $label . ":</div>";
                echo "<div class='chart-bar'>";
                echo "<div class='chart-bar-fill' style='width: " . $bar_width . "%;'></div>";
                echo "<span class='bar-score-text'>" . number_format($score, 2) . "</span>";
                echo "</div>";
                echo "</div>";
            }
            echo "</div>"; // End chart-container

            // Display scores for each criterion
            echo "<div class='criterion-scores-container mt-8'>";
            echo "<h3 class='text-xl font-semibold mb-4 text-center'>คะแนนที่ได้ในแต่ละเกณฑ์ย่อย</h3>";

            // Group criteria by dimension for better readability
            $grouped_criterion_scores = [];
            foreach ($criterion_calculated_scores as $id => $score) {
                $dimension_id = floor((float)$id);
                if (!isset($grouped_criterion_scores[$dimension_id])) {
                    $grouped_criterion_scores[$dimension_id] = [];
                }
                $grouped_criterion_scores[$dimension_id][$id] = $score;
            }

            foreach ($grouped_criterion_scores as $dimension_id => $criteria) {
                echo "<h4 class='text-lg font-semibold mt-4 mb-2'>มิติที่ " . $dimension_id . ": " . array_keys($max_dimension_scores)[$dimension_id-1] . "</h4>"; // Using array_keys to get dimension name
                echo "<ul class='list-disc list-inside ml-4'>";
                foreach ($criteria as $id => $score) {
                    echo "<li class='text-sm text-gray-700'><strong>" . $id . " " . ($criterion_descriptions[$id] ?? 'Unknown Criterion') . ":</strong> " . number_format($score, 2) . " คะแนน</li>";
                }
                echo "</ul>";
            }
            echo "</div>"; // End criterion-scores-container


            echo "<div class='flex justify-center mt-8'>";
            echo "<button type='button' onclick='window.location.href=\"" . htmlspecialchars($_SERVER["PHP_SELF"]) . "\"' class='btn-secondary'>ประเมินสหกรณ์ใหม่</button>";
            echo "</div>";
            echo "</div>"; // End result-box
        }
        ?>

        <form action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>" method="post" class="space-y-6">
            <h2 class="text-2xl mb-4">ข้อมูลทั่วไปของสหกรณ์</h2>
            <div class="form-group">
                <label for="cooperative_name" class="block text-sm font-medium text-gray-700">ชื่อสหกรณ์:</label>
                <input type="text" id="cooperative_name" name="cooperative_name" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
            </div>
            <div class="form-group">
                <label for="cooperative_type" class="block text-sm font-medium text-gray-700">ประเภทสหกรณ์:</label>
                <select id="cooperative_type" name="cooperative_type" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือกประเภท</option>
                    <option value="เกษตร">สหกรณ์การเกษตร</option>
                    <option value="นิคม">สหกรณ์นิคม</option>
                    <option value="ประมง">สหกรณ์ประมง</option>
                    <option value="ออมทรัพย์">สหกรณ์ออมทรัพย์</option>
                    <option value="เครดิตยูเนี่ยน">สหกรณ์เครดิตยูเนี่ยน</option>
                    <option value="ร้านค้า">สหกรณ์ร้านค้า</option>
                    <option value="บริการ">สหกรณ์บริการ</option>
                    <option value="กลุ่มเกษตรกร">กลุ่มเกษตรกร</option>
                </select>
            </div>
            <div class="form-group">
                <label for="assessment_date" class="block text-sm font-medium text-gray-700">วันที่ประเมิน:</label>
                <input type="date" id="assessment_date" name="assessment_date" value="<?php echo date('Y-m-d'); ?>" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
            </div>
            <div class="form-group">
                <label for="assessed_by" class="block text-sm font-medium text-gray-700">ผู้ประเมิน:</label>
                <input type="text" id="assessed_by" name="assessed_by" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
            </div>

            <h2 class="text-2xl mb-4 pt-6 border-t border-gray-200">เงื่อนไขพื้นฐาน</h2>
            <div class="form-group space-y-2">
                <div class="flex items-center">
                    <input type="checkbox" id="basic_condition_close_account" name="basic_condition_close_account" class="rounded text-indigo-600 focus:ring-indigo-500">
                    <label for="basic_condition_close_account" class="ml-2 block text-sm font-medium text-gray-700">ปีที่ประเมินต้องปิดบัญชีได้</label>
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="basic_condition_general_meeting" name="basic_condition_general_meeting" class="rounded text-indigo-600 focus:ring-indigo-500">
                    <label for="basic_condition_general_meeting" class="ml-2 block text-sm font-medium text-gray-700">ประชุมใหญ่ได้</label>
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="basic_condition_approve_financial" name="basic_condition_approve_financial" class="rounded text-indigo-600 focus:ring-indigo-500">
                    <label for="basic_condition_approve_financial" class="ml-2 block text-sm font-medium text-gray-700">ประชุมใหญ่และอนุมัติงบการเงินได้</label>
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="cannot_close_accounts_3_years" name="cannot_close_accounts_3_years" class="rounded text-indigo-600 focus:ring-indigo-500">
                    <label for="cannot_close_accounts_3_years" class="ml-2 block text-sm font-medium text-gray-700">ปิดบัญชีไม่ได้ต่อเนื่องตั้งแต่ 3 ปีบัญชีขึ้นไป</label>
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="is_overall_control_assessment" name="is_overall_control_assessment" class="rounded text-indigo-600 focus:ring-indigo-500">
                    <label for="is_overall_control_assessment" class="ml-2 block text-sm font-medium text-gray-700">ประเมินการควบคุมภายในแบบภาพรวม (จัดชั้นสูงสุดที่ ชั้น 2)</label>
                </div>
            </div>

            <h2 class="text-2xl mb-4 pt-6 border-t border-gray-200">มิติที่ 1: ความสามารถในการให้บริการสมาชิก (30 คะแนน)</h2>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700">1.1 อัตราส่วนของสมาชิกที่มีส่วนร่วมในการดำเนินธุรกิจกับสหกรณ์ (ร้อยละ):</label>
                <div class="input-pair">
                    <span class="sub-label">จำนวนสมาชิกที่ร่วมธุรกิจ:</span>
                    <input type="number" step="0.01" id="criterion_1_1_numerator" name="criterion_1_1_numerator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>/</span>
                    <span class="sub-label">จำนวนสมาชิกทั้งหมด:</span>
                    <input type="number" step="0.01" id="criterion_1_1_denominator" name="criterion_1_1_denominator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                </div>
            </div>
            <div class="form-group">
                <label for="criterion_1_2" class="block text-sm font-medium text-gray-700">1.2 ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง สหกรณ์ต้องมีการจัดสรรกำไรสุทธิและจ่ายทุนสวัสดิการสมาชิกและทุนสาธารณประโยชน์:</label>
                <select id="criterion_1_2" name="criterion_1_2" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="จัดสรร 2 ทุน และจ่าย 2 ทุน ทั้ง 2 ปีบัญชี">จัดสรร 2 ทุน และจ่าย 2 ทุน ทั้ง 2 ปีบัญชี</option>
                    <option value="จัดสรร 2 ทุน ทั้ง 2 ปีบัญชี">จัดสรร 2 ทุน ทั้ง 2 ปีบัญชี</option>
                    <option value="จัดสรร 1 ทุน ทั้ง 2 ปีบัญชี และจ่าย 1 ทุน 1 ปีบัญชี">จัดสรร 1 ทุน ทั้ง 2 ปีบัญชี และจ่าย 1 ทุน 1 ปีบัญชี</option>
                    <option value="ไม่มีการจัดสรร 2 ทุน ทั้ง 2 ปีบัญชี หรือ จัดสรร 1 ทุน ทั้ง 1 ปีบัญชี">ไม่มีการจัดสรร 2 ทุน ทั้ง 2 ปีบัญชี หรือ จัดสรร 1 ทุน ทั้ง 1 ปีบัญชี</option>
                    <option value="ไม่มีการจัดสรรกำไรสุทธิฯ ปีใดปีหนึ่ง หรือทั้ง 2 ปีบัญชี">ไม่มีการจัดสรรกำไรสุทธิฯ ปีใดปีหนึ่ง หรือทั้ง 2 ปีบัญชี</option>
                </select>
            </div>
            <div class="form-group">
                <label for="criterion_1_3" class="block text-sm font-medium text-gray-700">1.3 จำนวนประเภทธุรกิจที่สหกรณ์ดำเนินงาน (จำนวน):</label>
                <input type="number" id="criterion_1_3" name="criterion_1_3" placeholder="เช่น 4" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
            </div>

            <h2 class="text-2xl mb-4 pt-6 border-t border-gray-200">มิติที่ 2: ประสิทธิภาพในการดำเนินธุรกิจ (20 คะแนน)</h2>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700">2.1 อัตราส่วนหนี้สินต่อทุน (เท่า):</label>
                <div class="input-pair">
                    <span class="sub-label">หนี้สินรวม:</span>
                    <input type="number" step="0.01" id="criterion_2_1_numerator" name="criterion_2_1_numerator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>/</span>
                    <span class="sub-label">ทุนรวม:</span>
                    <input type="number" step="0.01" id="criterion_2_1_denominator" name="criterion_2_1_denominator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                </div>
            </div>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700">2.2 อัตราส่วนทุนสำรองต่อสินทรัพย์ (เท่า):</label>
                <div class="input-pair">
                    <span class="sub-label">ทุนสำรอง:</span>
                    <input type="number" step="0.01" id="criterion_2_2_numerator" name="criterion_2_2_numerator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>/</span>
                    <span class="sub-label">สินทรัพย์รวม:</span>
                    <input type="number" step="0.01" id="criterion_2_2_denominator" name="criterion_2_2_denominator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                </div>
            </div>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700">2.3 อัตราผลตอบแทนต่อสินทรัพย์ (ร้อยละ):</label>
                <div class="input-pair">
                    <span class="sub-label">กำไรสุทธิ:</span>
                    <input type="number" step="0.01" id="criterion_2_3_numerator" name="criterion_2_3_numerator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                </div>
                <div class="input-pair mt-2">
                    <span class="sub-label">สินทรัพย์รวมปีก่อน:</span>
                    <input type="number" step="0.01" id="criterion_2_3_previous_year_asset" name="criterion_2_3_previous_year_asset" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>+</span>
                    <span class="sub-label">สินทรัพย์รวมปีปัจจุบัน:</span>
                    <input type="number" step="0.01" id="criterion_2_3_current_year_asset" name="criterion_2_3_current_year_asset" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>/ 2 (สินทรัพย์ถัวเฉลี่ย)</span>
                </div>
            </div>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700">2.4 อัตราค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่ายดำเนินงาน (ร้อยละ):</label>
                <div class="input-pair">
                    <span class="sub-label">ค่าใช้จ่ายดำเนินงาน:</span>
                    <input type="number" step="0.01" id="criterion_2_4_numerator" name="criterion_2_4_numerator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>/</span>
                    <span class="sub-label">กำไรก่อนหักค่าใช้จ่ายดำเนินงาน:</span>
                    <input type="number" step="0.01" id="criterion_2_4_denominator" name="criterion_2_4_denominator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                </div>
            </div>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700">2.5 อัตราส่วนทุนหมุนเวียน (เท่า):</label>
                <div class="input-pair">
                    <span class="sub-label">สินทรัพย์หมุนเวียน:</span>
                    <input type="number" step="0.01" id="criterion_2_5_numerator" name="criterion_2_5_numerator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>/</span>
                    <span class="sub-label">หนี้สินหมุนเวียน:</span>
                    <input type="number" step="0.01" id="criterion_2_5_denominator" name="criterion_2_5_denominator" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                </div>
            </div>
            <div class="form-group">
                <label class="block text-sm font-medium text-gray-700">2.6 อัตราลูกหนี้ระยะสั้นที่ชำระหนี้ได้ตามกำหนด (ร้อยละ):</label>
                <div class="radio-option">
                    <input type="radio" id="criterion_2_6_calculate" name="criterion_2_6_input_method" value="calculate" checked onchange="toggleCriterion2_6Inputs()">
                    <label for="criterion_2_6_calculate" class="ml-2 block text-sm font-medium text-gray-700">คำนวณจากข้อมูล</label>
                </div>
                <div id="criterion_2_6_calculation_inputs" class="input-pair mt-2">
                    <span class="sub-label">ลูกหนี้ที่ชำระได้:</span>
                    <input type="number" step="0.01" id="criterion_2_6_numerator" name="criterion_2_6_numerator" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>/</span>
                    <span class="sub-label">ลูกหนี้ระยะสั้นทั้งหมด:</span>
                    <input type="number" step="0.01" id="criterion_2_6_denominator" name="criterion_2_6_denominator" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                </div>
                <div class="radio-option mt-2">
                    <input type="radio" id="criterion_2_6_direct" name="criterion_2_6_input_method" value="direct" onchange="toggleCriterion2_6Inputs()">
                    <label for="criterion_2_6_direct" class="ml-2 block text-sm font-medium text-gray-700">ระบุค่าร้อยละโดยตรง</label>
                </div>
                <div id="criterion_2_6_direct_input" class="input-pair mt-2" style="display: none;">
                    <span class="sub-label">ค่าร้อยละ:</span>
                    <input type="number" step="0.01" id="criterion_2_6_direct_percentage" name="criterion_2_6_direct_percentage" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <span>%</span>
                </div>
            </div>

            <h2 class="text-2xl mb-4 pt-6 border-t border-gray-200">มิติที่ 3: ประสิทธิภาพในการจัดการองค์กร (20 คะแนน)</h2>
            <div class="form-group">
                <label for="criterion_3_1" class="block text-sm font-medium text-gray-700">3.1 การใช้เทคโนโลยีการบัญชีในการบริหารจัดการ:</label>
                <select id="criterion_3_1" name="criterion_3_1" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="ใช้งานเต็มระบบ">ใช้งานเต็มระบบ</option>
                    <option value="ใช้งานบางส่วน">ใช้งานบางส่วน</option>
                    <option value="ไม่ได้ใช้งาน">ไม่ได้ใช้งาน</option>
                </select>
            </div>
            <div class="form-group">
                <label for="criterion_3_2" class="block text-sm font-medium text-gray-700">3.2 สภาพแวดล้อมการควบคุม:</label>
                <select id="criterion_3_2" name="criterion_3_2" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="ดีมาก">ดีมาก</option>
                    <option value="ดี">ดี</option>
                    <option value="พอใช้">พอใช้</option>
                    <option value="ต้องปรับปรุง">ต้องปรับปรุง</option>
                </select>
            </div>
            <div class="form-group">
                <label for="criterion_3_3" class="block text-sm font-medium text-gray-700">3.3 ความเสี่ยงและกิจกรรมควบคุม:</label>
                <select id="criterion_3_3" name="criterion_3_3" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="ดีมาก">ดีมาก</option>
                    <option value="ดี">ดี</option>
                    <option value="พอใช้">พอใช้</option>
                    <option value="ต้องปรับปรุง">ต้องปรับปรุง</option>
                </select>
            </div>
            <div class="form-group">
                <label for="criterion_3_4" class="block text-sm font-medium text-gray-700">3.4 ระบบข้อมูลสารสนเทศและการสื่อสาร:</label>
                <select id="criterion_3_4" name="criterion_3_4" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="ดีมาก">ดีมาก</option>
                    <option value="ดี">ดี</option>
                    <option value="พอใช้">พอใช้</option>
                    <option value="ต้องปรับปรุง">ต้องปรับปรุง</option>
                </select>
            </div>
            <div class="form-group">
                <label for="criterion_3_5" class="block text-sm font-medium text-gray-700">3.5 ระบบการติดตามและประเมินผล:</label>
                <select id="criterion_3_5" name="criterion_3_5" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="ดีมาก">ดีมาก</option>
                    <option value="ดี">ดี</option>
                    <option value="พอใช้">พอใช้</option>
                    <option value="ต้องปรับปรุง">ต้องปรับปรุง</option>
                </select>
            </div>

            <h2 class="text-2xl mb-4 pt-6 border-t border-gray-200">มิติที่ 4: ประสิทธิภาพของการบริหารงาน (30 คะแนน)</h2>
            <div class="form-group">
                <label for="criterion_4_1" class="block text-sm font-medium text-gray-700">4.1 ผลการดำเนินงานของสหกรณ์ต้องไม่มีการฝ่าฝืนระเบียบ คำสั่งนายทะเบียน ข้อกฎหมาย:</label>
                <select id="criterion_4_1" name="criterion_4_1" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="ไม่มีข้อบกพร่อง/แก้ไขแล้วเสร็จสมบูรณ์">ไม่มีข้อบกพร่อง/แก้ไขแล้วเสร็จสมบูรณ์</option>
                    <option value="เสร็จต้องติดตาม">เสร็จต้องติดตาม</option>
                    <option value="อยู่ระหว่างดำเนินการแก้ไข">อยู่ระหว่างดำเนินการแก้ไข</option>
                    <option value="ยังไม่เริ่มดำเนินการแก้ไข/ตรวจพบ">ยังไม่เริ่มดำเนินการแก้ไข/ตรวจพบ</option>
                </select>
            </div>
            <div class="form-group">
                <label for="criterion_4_2" class="block text-sm font-medium text-gray-700">4.2 ผลการดำเนินงานในรอบสองปีบัญชีย้อนหลัง สหกรณ์มีผลการดำเนินงานไม่ขาดทุน:</label>
                <select id="criterion_4_2" name="criterion_4_2" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="กำไรทั้งสองปี">กำไรทั้งสองปี</option>
                    <option value="ขาดทุนปีแรก กำไรปีสอง">ขาดทุนปีแรก กำไรปีสอง</option>
                    <option value="กำไรปีแรก ขาดทุนปีสอง">กำไรปีแรก ขาดทุนปีสอง</option>
                    <option value="ขาดทุนทั้งสองปี">ขาดทุนทั้งสองปี</option>
                    <option value="ขาดทุนเพราะมีข้อยกเว้น">ขาดทุนเพราะมีข้อยกเว้น</option>
                </select>
            </div>
            <div class="form-group">
                <label for="criterion_4_3" class="block text-sm font-medium text-gray-700">4.3 สหกรณ์จัดทำงบการเงินแล้วเสร็จ และส่งให้ผู้สอบบัญชีรับตรวจ และแสดงความเห็นต่องบการเงินแล้วนำเสนอต่อที่ประชุมใหญ่อนุมัติภายใน 150 วัน:</label>
                <select id="criterion_4_3" name="criterion_4_3" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="ภายใน 30 วัน">ภายใน 30 วัน</option>
                    <option value="ภายใน 60 วัน">ภายใน 60 วัน</option>
                    <option value="ภายใน 90 วัน">ภายใน 90 วัน</option>
                    <option value="เกิน 90 วัน">เกิน 90 วัน</option>
                    <option value="ประชุมใหญ่ไม่มีงบ">ประชุมใหญ่ไม่มีงบ</option>
                </select>
            </div>
            <div class="form-group">
                <label for="criterion_4_4" class="block text-sm font-medium text-gray-700">4.4 สหกรณ์จัดจ้างเจ้าหน้าที่ปฏิบัติงานประจำรับผิดชอบดำเนินงานและธุรกิจของสหกรณ์:</label>
                <select id="criterion_4_4" name="criterion_4_4" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                    <option value="">เลือก</option>
                    <option value="จัดจ้างประจำ">จัดจ้างประจำ</option>
                    <option value="จัดจ้างชั่วคราว">จัดจ้างชั่วคราว</option>
                    <option value="คำสั่งมอบหมาย">คำสั่งมอบหมาย</option>
                    <option value="ไม่มีการจ้าง ไม่มีการมอบหมาย">ไม่มีการจ้าง ไม่มีการมอบหมาย</option>
                </select>
            </div>

            <div class="flex justify-center mt-8">
                <button type="submit" class="btn-primary">บันทึกและประเมินผล</button>
            </div>
        </form>
    </div>

    <script>
        function toggleCriterion2_6Inputs() {
            const calculateRadio = document.getElementById('criterion_2_6_calculate');
            const calculationInputs = document.getElementById('criterion_2_6_calculation_inputs');
            const directInput = document.getElementById('criterion_2_6_direct_input');

            // Get the input fields within each section
            const numeratorInput = document.getElementById('criterion_2_6_numerator');
            const denominatorInput = document.getElementById('criterion_2_6_denominator');
            const directPercentageInput = document.getElementById('criterion_2_6_direct_percentage');

            if (calculateRadio.checked) {
                calculationInputs.style.display = 'flex';
                directInput.style.display = 'none';
                // Set required for calculation inputs
                numeratorInput.setAttribute('required', 'required');
                denominatorInput.setAttribute('required', 'required');
                directPercentageInput.removeAttribute('required');
            } else {
                calculationInputs.style.display = 'none';
                directInput.style.display = 'flex';
                // Set required for direct input
                numeratorInput.removeAttribute('required');
                denominatorInput.removeAttribute('required');
                directPercentageInput.setAttribute('required', 'required');
            }
        }

        // Initialize the correct display on page load
        document.addEventListener('DOMContentLoaded', toggleCriterion2_6Inputs);
    </script>
</body>
</html>
