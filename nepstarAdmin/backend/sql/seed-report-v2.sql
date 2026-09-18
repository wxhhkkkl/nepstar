-- V2 report classification seed
-- Source: reportFront/report-v2/src/data/report.js
--
-- This script is idempotent. It creates the report's system categories,
-- level-2 indicators, two recommendation plans, and their product links.
-- Product images use the V2 LAN dev server for local preview. Replace these
-- URLs with OSS URLs before deploying outside the local network.

USE `nepstar`;

START TRANSACTION;

-- Keep the existing first seed rows compatible with the stable V2 codes.
UPDATE sa_indicator
SET ind_code = 'SYS_ENDOCRINE',
    description = '松果体、胰岛素、肾上腺和性腺相关的内分泌节律状态。',
    sort_order = 1,
    status = 1
WHERE parent_id IS NULL AND ind_name = '内分泌' AND ind_code = 'NFM_01'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM sa_indicator WHERE ind_code = 'SYS_ENDOCRINE') AS used_code);

UPDATE sa_indicator
SET ind_code = 'SYS_ENDOCRINE_PINEAL',
    description = '松果体分泌与睡眠节律、晚间恢复相关的重点指标。',
    sort_order = 4,
    status = 1
WHERE ind_name = '松果体分泌' AND ind_code = 'SGT_01'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM sa_indicator WHERE ind_code = 'SYS_ENDOCRINE_PINEAL') AS used_code);

-- Level-1 report systems. Order follows reportSnapshot.systemOrder.
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, t.code, t.name, t.description, t.sort_order, 1
FROM (
    SELECT 'SYS_ENDOCRINE' code, '内分泌' name, '松果体、胰岛素、肾上腺和性腺相关的内分泌节律状态。' description, 1 sort_order
    UNION ALL SELECT 'SYS_LUNG', '肺功能', '血氧、呼吸睡眠、肺活量和气道阻力相关的呼吸能力。', 2
    UNION ALL SELECT 'SYS_BONE', '骨骼', '骨质疏松、骨质增生及颈腰椎钙化相关的骨骼状态。', 3
    UNION ALL SELECT 'SYS_CARDIO', '心血管', '血脂、血管弹性和心肌耗氧量相关的循环状态。', 4
    UNION ALL SELECT 'SYS_DIGEST', '消化系统', '肝内脂肪、胃肠蠕动和小肠吸收相关的消化能力。', 5
    UNION ALL SELECT 'SYS_FEMALE', '女性功能', '黄体酮、妇科炎症和乳腺风险相关的女性专项指标。', 6
    UNION ALL SELECT 'SYS_IMMUNE', '免疫力', '淋巴、免疫球蛋白、呼吸道、脾脏和消化道防御能力。', 7
    UNION ALL SELECT 'SYS_MALE', '男性功能', '勃起功能及前列腺相关的男性专项指标。', 8
) t
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator i WHERE i.ind_code = t.code)
  AND NOT EXISTS (SELECT 1 FROM sa_indicator i WHERE i.parent_id IS NULL AND i.ind_name = t.name);

-- Normalize parent metadata on reruns or after a manually created row.
UPDATE sa_indicator SET sort_order = 1, status = 1 WHERE ind_code = 'SYS_ENDOCRINE';
UPDATE sa_indicator SET sort_order = 2, status = 1 WHERE ind_code = 'SYS_LUNG';
UPDATE sa_indicator SET sort_order = 3, status = 1 WHERE ind_code = 'SYS_BONE';
UPDATE sa_indicator SET sort_order = 4, status = 1 WHERE ind_code = 'SYS_CARDIO';
UPDATE sa_indicator SET sort_order = 5, status = 1 WHERE ind_code = 'SYS_DIGEST';
UPDATE sa_indicator SET sort_order = 6, status = 1 WHERE ind_code = 'SYS_FEMALE';
UPDATE sa_indicator SET sort_order = 7, status = 1 WHERE ind_code = 'SYS_IMMUNE';
UPDATE sa_indicator SET sort_order = 8, status = 1 WHERE ind_code = 'SYS_MALE';

-- Level-2 indicators. The order and names mirror report.js exactly.
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT p.id, t.code, t.name, t.description, t.sort_order, 1
FROM (
    SELECT 'SYS_ENDOCRINE' parent_code, 'SYS_ENDOCRINE_INSULIN' code, '胰岛素' name, '胰岛素相关代谢调节状态。' description, 1 sort_order
    UNION ALL SELECT 'SYS_ENDOCRINE', 'SYS_ENDOCRINE_ADRENAL', '肾上腺分泌', '肾上腺分泌与压力适应状态。', 2
    UNION ALL SELECT 'SYS_ENDOCRINE', 'SYS_ENDOCRINE_GONAD', '性腺分泌', '性腺分泌与生理节律状态。', 3
    UNION ALL SELECT 'SYS_ENDOCRINE', 'SYS_ENDOCRINE_PINEAL', '松果体分泌', '松果体分泌与睡眠节律、晚间恢复相关的重点指标。', 4
    UNION ALL SELECT 'SYS_LUNG', 'SYS_LUNG_SLEEP_BREATHING', '呼吸睡眠', '夜间呼吸质量与睡眠呼吸状态。', 1
    UNION ALL SELECT 'SYS_LUNG', 'SYS_LUNG_VC', '肺活量 VC', '肺活量和呼吸储备能力。', 2
    UNION ALL SELECT 'SYS_LUNG', 'SYS_LUNG_AIRWAY_RESISTANCE', '气道阻力 RAM', '气道通畅度和呼吸阻力状态。', 3
    UNION ALL SELECT 'SYS_BONE', 'SYS_BONE_OSTEOPOROSIS', '骨质疏松', '骨量流失与骨质疏松风险，是本次骨骼重点问题。', 1
    UNION ALL SELECT 'SYS_BONE', 'SYS_BONE_HYPEROSTOSIS', '骨质增生', '骨质增生相关状态。', 2
    UNION ALL SELECT 'SYS_BONE', 'SYS_BONE_CERVICAL_CALCIFICATION', '颈椎钙化', '颈椎钙化相关状态。', 3
    UNION ALL SELECT 'SYS_BONE', 'SYS_BONE_LUMBAR_CALCIFICATION', '腰椎钙化', '腰椎钙化相关状态。', 4
    UNION ALL SELECT 'SYS_CARDIO', 'SYS_CARDIO_LIPID', '血脂', '血脂相关循环风险指标。', 1
    UNION ALL SELECT 'SYS_CARDIO', 'SYS_CARDIO_VASCULAR_ELASTICITY', '血管弹性', '血管弹性与循环顺应性。', 2
    UNION ALL SELECT 'SYS_CARDIO', 'SYS_CARDIO_MYOCARDIAL_OXYGEN', '心肌耗氧量', '心肌活动与耗氧状态。', 3
    UNION ALL SELECT 'SYS_DIGEST', 'SYS_DIGEST_LIVER_FAT', '肝内脂肪含量', '肝内脂肪相关消化代谢状态。', 1
    UNION ALL SELECT 'SYS_DIGEST', 'SYS_DIGEST_GASTRIC_MOTILITY', '胃蠕动功能', '胃部蠕动和排空状态。', 2
    UNION ALL SELECT 'SYS_DIGEST', 'SYS_DIGEST_SMALL_INTESTINE_ABSORB', '小肠吸收功能', '小肠营养吸收能力。', 3
    UNION ALL SELECT 'SYS_DIGEST', 'SYS_DIGEST_SMALL_INTESTINE_MOTILITY', '小肠蠕动功能', '小肠蠕动状态。', 4
    UNION ALL SELECT 'SYS_DIGEST', 'SYS_DIGEST_GASTRIC_ABSORB', '胃吸收功能', '胃部吸收与消化状态。', 5
    UNION ALL SELECT 'SYS_FEMALE', 'SYS_FEMALE_PROGESTERONE', '黄体酮', '女性周期相关激素状态。', 1
    UNION ALL SELECT 'SYS_FEMALE', 'SYS_FEMALE_ENDOCRINE_DISORDER', '内分泌失调指数', '女性内分泌平衡相关状态。', 2
    UNION ALL SELECT 'SYS_FEMALE', 'SYS_FEMALE_CERVIX', '宫颈炎指数', '宫颈健康相关风险指标。', 3
    UNION ALL SELECT 'SYS_FEMALE', 'SYS_FEMALE_VAGINAL', '阴道炎指数', '阴道健康相关风险指标。', 4
    UNION ALL SELECT 'SYS_FEMALE', 'SYS_FEMALE_BREAST', '乳腺增生风险', '乳腺健康相关风险指标。', 5
    UNION ALL SELECT 'SYS_MALE', 'SYS_MALE_ED', '勃起功能', '男性勃起功能专项状态。', 1
    UNION ALL SELECT 'SYS_MALE', 'SYS_MALE_PROSTATE_HYPERPLASIA', '前列腺增生', '前列腺增生相关状态。', 2
    UNION ALL SELECT 'SYS_MALE', 'SYS_MALE_PROSTATE_CALCIFICATION', '前列腺钙化', '前列腺钙化相关状态。', 3
    UNION ALL SELECT 'SYS_MALE', 'SYS_MALE_PROSTATE_INFLAMMATION', '前列腺炎症', '前列腺炎症相关状态。', 4
    UNION ALL SELECT 'SYS_IMMUNE', 'SYS_IMMUNE_LYMPH', '淋巴结', '淋巴结相关免疫防御状态。', 1
    UNION ALL SELECT 'SYS_IMMUNE', 'SYS_IMMUNE_TONSIL', '扁桃体免疫力', '扁桃体及上呼吸道免疫状态。', 2
    UNION ALL SELECT 'SYS_IMMUNE', 'SYS_IMMUNE_GLOBULIN', '免疫球蛋白', '免疫球蛋白相关防御状态。', 3
    UNION ALL SELECT 'SYS_IMMUNE', 'SYS_IMMUNE_RESPIRATORY', '呼吸道免疫力', '呼吸道黏膜免疫状态。', 4
    UNION ALL SELECT 'SYS_IMMUNE', 'SYS_IMMUNE_SPLEEN', '脾脏功能', '脾脏相关免疫状态。', 5
    UNION ALL SELECT 'SYS_IMMUNE', 'SYS_IMMUNE_DIGESTIVE', '消化道免疫力', '消化道屏障与免疫状态。', 6
) t
JOIN sa_indicator p ON p.ind_code = t.parent_code AND p.parent_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator i WHERE i.ind_code = t.code);

-- Products used by the two V2 recommendation plans.
INSERT INTO sa_product (product_name, description, detail_html, cover_url, status, sort_order)
SELECT '睡眠健康管理礼盒', '针对松果体节律偏弱，帮助建立稳定的睡眠节律与晚间恢复习惯。',
       '<p>睡眠节律管理与晚间恢复支持。</p>',
       'http://192.168.110.176:5173/睡眠健康管理方案.png', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM sa_product WHERE product_name = '睡眠健康管理礼盒');

INSERT INTO sa_product (product_name, description, detail_html, cover_url, status, sort_order)
SELECT '钙流失健康管理礼盒', '针对骨量流失风险，提供钙营养、维生素 D 与日常负重活动的连续管理参考。',
       '<p>钙营养支持与骨量日常管理。</p>',
       'http://192.168.110.176:5173/钙流失健康管理方案.png', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM sa_product WHERE product_name = '钙流失健康管理礼盒');

UPDATE sa_product SET cover_url = 'http://192.168.110.176:5173/睡眠健康管理方案.png', status = 1, sort_order = 1
WHERE product_name = '睡眠健康管理礼盒';
UPDATE sa_product SET cover_url = 'http://192.168.110.176:5173/钙流失健康管理方案.png', status = 1, sort_order = 2
WHERE product_name = '钙流失健康管理礼盒';

SET @sleep_product_id = (SELECT id FROM sa_product WHERE product_name = '睡眠健康管理礼盒' LIMIT 1);
SET @bone_product_id = (SELECT id FROM sa_product WHERE product_name = '钙流失健康管理礼盒' LIMIT 1);

INSERT INTO sa_product_image (product_id, image_url, sort_order)
SELECT @sleep_product_id, 'http://192.168.110.176:5173/睡眠健康管理方案.png', 0
FROM DUAL
WHERE @sleep_product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sa_product_image WHERE product_id = @sleep_product_id);

INSERT INTO sa_product_image (product_id, image_url, sort_order)
SELECT @bone_product_id, 'http://192.168.110.176:5173/钙流失健康管理方案.png', 0
FROM DUAL
WHERE @bone_product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sa_product_image WHERE product_id = @bone_product_id);

-- Plans and exact problem-level associations.
INSERT INTO sa_plan (plan_name, description, status, sort_order)
SELECT '松果体睡眠健康管理方案', '针对松果体节律偏弱，帮助建立稳定的睡眠节律与晚间恢复习惯。', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM sa_plan WHERE plan_name = '松果体睡眠健康管理方案');

INSERT INTO sa_plan (plan_name, description, status, sort_order)
SELECT '骨质疏松钙流失健康管理方案', '针对骨量流失风险，提供钙营养、维生素 D 与日常负重活动的连续管理参考。', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM sa_plan WHERE plan_name = '骨质疏松钙流失健康管理方案');

UPDATE sa_plan SET description = '针对松果体节律偏弱，帮助建立稳定的睡眠节律与晚间恢复习惯。', status = 1, sort_order = 1
WHERE plan_name = '松果体睡眠健康管理方案';
UPDATE sa_plan SET description = '针对骨量流失风险，提供钙营养、维生素 D 与日常负重活动的连续管理参考。', status = 1, sort_order = 2
WHERE plan_name = '骨质疏松钙流失健康管理方案';

SET @sleep_plan_id = (SELECT id FROM sa_plan WHERE plan_name = '松果体睡眠健康管理方案' LIMIT 1);
SET @bone_plan_id = (SELECT id FROM sa_plan WHERE plan_name = '骨质疏松钙流失健康管理方案' LIMIT 1);
SET @pineal_id = (SELECT id FROM sa_indicator WHERE ind_code = 'SYS_ENDOCRINE_PINEAL' LIMIT 1);
SET @osteoporosis_id = (SELECT id FROM sa_indicator WHERE ind_code = 'SYS_BONE_OSTEOPOROSIS' LIMIT 1);

DELETE FROM sa_plan_indicator WHERE plan_id = @sleep_plan_id AND indicator_id <> @pineal_id;
DELETE FROM sa_plan_indicator WHERE plan_id = @bone_plan_id AND indicator_id <> @osteoporosis_id;

INSERT INTO sa_plan_indicator (plan_id, indicator_id)
SELECT @sleep_plan_id, @pineal_id FROM DUAL
WHERE @sleep_plan_id IS NOT NULL AND @pineal_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sa_plan_indicator WHERE plan_id = @sleep_plan_id AND indicator_id = @pineal_id);

INSERT INTO sa_plan_indicator (plan_id, indicator_id)
SELECT @bone_plan_id, @osteoporosis_id FROM DUAL
WHERE @bone_plan_id IS NOT NULL AND @osteoporosis_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sa_plan_indicator WHERE plan_id = @bone_plan_id AND indicator_id = @osteoporosis_id);

INSERT INTO sa_plan_product (plan_id, product_id, sort_order)
SELECT @sleep_plan_id, @sleep_product_id, 0 FROM DUAL
WHERE @sleep_plan_id IS NOT NULL AND @sleep_product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sa_plan_product WHERE plan_id = @sleep_plan_id AND product_id = @sleep_product_id);

INSERT INTO sa_plan_product (plan_id, product_id, sort_order)
SELECT @bone_plan_id, @bone_product_id, 0 FROM DUAL
WHERE @bone_plan_id IS NOT NULL AND @bone_product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sa_plan_product WHERE plan_id = @bone_plan_id AND product_id = @bone_product_id);

COMMIT;
