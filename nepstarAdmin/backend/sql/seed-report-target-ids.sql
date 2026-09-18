-- 报告展示口径：V2 报告的系统与指标登记到旧报告文档中的 targetId
-- 生成依据：specs/003-report-v2-data-api/data-model.md §2（已逐项对照 inspect_target 核对）
--
-- 幂等，可重复执行。本脚本自包含：指标行不存在则创建，已存在则只更新映射。
-- 旧报告里的一级系统共 10 个，此处只登记 V2 展示的 8 个——
-- 营养状态 3163 / 有害物质 3195 / 皮肤系统 3244 不登记，因而不会出现在报告里。
-- 女性功能与男性功能分别对应旧二级分支 3152 / 3144，报告数据本身按性别只返回其中一支。

USE `nepstar`;

START TRANSACTION;

-- 一级系统（V2 的 8 个身体系统）
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, 'SYS_ENDOCRINE', '内分泌', '松果体、胰岛素、肾上腺和性腺相关的内分泌节律状态。', 1, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_ENDOCRINE');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, 'SYS_LUNG', '肺功能', '血氧、呼吸睡眠、肺活量和气道阻力相关的呼吸能力。', 2, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_LUNG');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, 'SYS_BONE', '骨骼', '骨质疏松、骨质增生及颈腰椎钙化相关的骨骼状态。', 3, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_BONE');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, 'SYS_CARDIO', '心血管', '血脂、血管弹性和心肌耗氧量相关的循环状态。', 4, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_CARDIO');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, 'SYS_DIGEST', '消化系统', '肝内脂肪、胃肠蠕动和小肠吸收相关的消化能力。', 5, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_DIGEST');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, 'SYS_FEMALE', '女性功能', '黄体酮、妇科炎症和乳腺风险相关的女性专项指标。', 6, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_FEMALE');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, 'SYS_MALE', '男性功能', '勃起功能及前列腺相关的男性专项指标。', 7, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_MALE');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, description, sort_order, status)
SELECT NULL, 'SYS_IMMUNE', '免疫力', '淋巴、免疫球蛋白、呼吸道、脾脏和消化道防御能力。', 8, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_IMMUNE');

-- 二级指标（旧报告里位于第三层，V2 提升到系统下直接展示）
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_ENDOCRINE_INSULIN', '胰岛素', 1, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_ENDOCRINE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_ENDOCRINE_INSULIN');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_ENDOCRINE_ADRENAL', '肾上腺分泌', 2, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_ENDOCRINE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_ENDOCRINE_ADRENAL');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_ENDOCRINE_GONAD', '性腺分泌', 3, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_ENDOCRINE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_ENDOCRINE_GONAD');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_ENDOCRINE_PINEAL', '松果体分泌', 4, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_ENDOCRINE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_ENDOCRINE_PINEAL');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_LUNG_SLEEP_BREATHING', '呼吸睡眠', 1, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_LUNG'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_LUNG_SLEEP_BREATHING');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_LUNG_VC', '肺活量 VC', 2, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_LUNG'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_LUNG_VC');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_LUNG_AIRWAY_RESISTANCE', '气道阻力 RAM', 3, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_LUNG'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_LUNG_AIRWAY_RESISTANCE');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_BONE_OSTEOPOROSIS', '骨质疏松', 1, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_BONE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_BONE_OSTEOPOROSIS');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_BONE_HYPEROSTOSIS', '骨质增生', 2, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_BONE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_BONE_HYPEROSTOSIS');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_BONE_CERVICAL_CALCIFICATION', '颈椎钙化', 3, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_BONE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_BONE_CERVICAL_CALCIFICATION');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_BONE_LUMBAR_CALCIFICATION', '腰椎钙化', 4, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_BONE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_BONE_LUMBAR_CALCIFICATION');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_CARDIO_LIPID', '血脂', 1, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_CARDIO'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_CARDIO_LIPID');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_CARDIO_VASCULAR_ELASTICITY', '血管弹性', 2, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_CARDIO'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_CARDIO_VASCULAR_ELASTICITY');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_CARDIO_MYOCARDIAL_OXYGEN', '心肌耗氧量', 3, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_CARDIO'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_CARDIO_MYOCARDIAL_OXYGEN');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_DIGEST_LIVER_FAT', '肝内脂肪含量', 1, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_DIGEST'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_DIGEST_LIVER_FAT');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_DIGEST_GASTRIC_MOTILITY', '胃蠕动功能', 2, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_DIGEST'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_DIGEST_GASTRIC_MOTILITY');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_DIGEST_SMALL_INTESTINE_ABSORB', '小肠吸收功能', 3, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_DIGEST'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_DIGEST_SMALL_INTESTINE_ABSORB');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_DIGEST_SMALL_INTESTINE_MOTILITY', '小肠蠕动功能', 4, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_DIGEST'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_DIGEST_SMALL_INTESTINE_MOTILITY');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_DIGEST_GASTRIC_ABSORB', '胃吸收功能', 5, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_DIGEST'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_DIGEST_GASTRIC_ABSORB');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_FEMALE_PROGESTERONE', '黄体酮', 1, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_FEMALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_FEMALE_PROGESTERONE');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_FEMALE_ENDOCRINE_DISORDER', '内分泌失调指数', 2, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_FEMALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_FEMALE_ENDOCRINE_DISORDER');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_FEMALE_CERVIX', '宫颈炎指数', 3, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_FEMALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_FEMALE_CERVIX');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_FEMALE_VAGINAL', '阴道炎指数', 4, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_FEMALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_FEMALE_VAGINAL');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_FEMALE_BREAST', '乳腺增生风险', 5, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_FEMALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_FEMALE_BREAST');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_MALE_ED', '勃起功能', 1, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_MALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_MALE_ED');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_MALE_PROSTATE_HYPERPLASIA', '前列腺增生', 2, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_MALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_MALE_PROSTATE_HYPERPLASIA');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_MALE_PROSTATE_CALCIFICATION', '前列腺钙化', 3, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_MALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_MALE_PROSTATE_CALCIFICATION');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_MALE_PROSTATE_INFLAMMATION', '前列腺炎症', 4, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_MALE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_MALE_PROSTATE_INFLAMMATION');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_IMMUNE_LYMPH', '淋巴结', 1, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_IMMUNE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_IMMUNE_LYMPH');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_IMMUNE_TONSIL', '扁桃体免疫力', 2, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_IMMUNE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_IMMUNE_TONSIL');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_IMMUNE_GLOBULIN', '免疫球蛋白', 3, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_IMMUNE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_IMMUNE_GLOBULIN');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_IMMUNE_RESPIRATORY', '呼吸道免疫力', 4, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_IMMUNE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_IMMUNE_RESPIRATORY');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_IMMUNE_SPLEEN', '脾脏功能', 5, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_IMMUNE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_IMMUNE_SPLEEN');
INSERT INTO sa_indicator (parent_id, ind_code, ind_name, sort_order, status)
SELECT p.id, 'SYS_IMMUNE_DIGESTIVE', '消化道免疫力', 6, 1
FROM sa_indicator p WHERE p.ind_code = 'SYS_IMMUNE'
  AND NOT EXISTS (SELECT 1 FROM sa_indicator WHERE ind_code = 'SYS_IMMUNE_DIGESTIVE');

-- 登记 targetId（唯一约束保证同一 targetId 不会落到两个指标上）
UPDATE sa_indicator SET target_id = 3115, sort_order = 1 WHERE ind_code = 'SYS_ENDOCRINE';
UPDATE sa_indicator SET target_id = 3108, sort_order = 2 WHERE ind_code = 'SYS_LUNG';
UPDATE sa_indicator SET target_id = 3127, sort_order = 3 WHERE ind_code = 'SYS_BONE';
UPDATE sa_indicator SET target_id = 3087, sort_order = 4 WHERE ind_code = 'SYS_CARDIO';
UPDATE sa_indicator SET target_id = 3095, sort_order = 5 WHERE ind_code = 'SYS_DIGEST';
UPDATE sa_indicator SET target_id = 3152, sort_order = 6 WHERE ind_code = 'SYS_FEMALE';
UPDATE sa_indicator SET target_id = 3144, sort_order = 7 WHERE ind_code = 'SYS_MALE';
UPDATE sa_indicator SET target_id = 3135, sort_order = 8 WHERE ind_code = 'SYS_IMMUNE';
UPDATE sa_indicator SET target_id = 3211 WHERE ind_code = 'SYS_ENDOCRINE_INSULIN';
UPDATE sa_indicator SET target_id = 3123 WHERE ind_code = 'SYS_ENDOCRINE_ADRENAL';
UPDATE sa_indicator SET target_id = 3124 WHERE ind_code = 'SYS_ENDOCRINE_GONAD';
UPDATE sa_indicator SET target_id = 3125 WHERE ind_code = 'SYS_ENDOCRINE_PINEAL';
UPDATE sa_indicator SET target_id = 3111 WHERE ind_code = 'SYS_LUNG_SLEEP_BREATHING';
UPDATE sa_indicator SET target_id = 3112 WHERE ind_code = 'SYS_LUNG_VC';
UPDATE sa_indicator SET target_id = 3114 WHERE ind_code = 'SYS_LUNG_AIRWAY_RESISTANCE';
UPDATE sa_indicator SET target_id = 3130 WHERE ind_code = 'SYS_BONE_OSTEOPOROSIS';
UPDATE sa_indicator SET target_id = 3132 WHERE ind_code = 'SYS_BONE_HYPEROSTOSIS';
UPDATE sa_indicator SET target_id = 3133 WHERE ind_code = 'SYS_BONE_CERVICAL_CALCIFICATION';
UPDATE sa_indicator SET target_id = 3134 WHERE ind_code = 'SYS_BONE_LUMBAR_CALCIFICATION';
UPDATE sa_indicator SET target_id = 3089 WHERE ind_code = 'SYS_CARDIO_LIPID';
UPDATE sa_indicator SET target_id = 3090 WHERE ind_code = 'SYS_CARDIO_VASCULAR_ELASTICITY';
UPDATE sa_indicator SET target_id = 3094 WHERE ind_code = 'SYS_CARDIO_MYOCARDIAL_OXYGEN';
UPDATE sa_indicator SET target_id = 3098 WHERE ind_code = 'SYS_DIGEST_LIVER_FAT';
UPDATE sa_indicator SET target_id = 3103 WHERE ind_code = 'SYS_DIGEST_GASTRIC_MOTILITY';
UPDATE sa_indicator SET target_id = 3104 WHERE ind_code = 'SYS_DIGEST_SMALL_INTESTINE_ABSORB';
UPDATE sa_indicator SET target_id = 3105 WHERE ind_code = 'SYS_DIGEST_SMALL_INTESTINE_MOTILITY';
UPDATE sa_indicator SET target_id = 3106 WHERE ind_code = 'SYS_DIGEST_GASTRIC_ABSORB';
UPDATE sa_indicator SET target_id = 3154 WHERE ind_code = 'SYS_FEMALE_PROGESTERONE';
UPDATE sa_indicator SET target_id = 3224 WHERE ind_code = 'SYS_FEMALE_ENDOCRINE_DISORDER';
UPDATE sa_indicator SET target_id = 3159 WHERE ind_code = 'SYS_FEMALE_CERVIX';
UPDATE sa_indicator SET target_id = 3160 WHERE ind_code = 'SYS_FEMALE_VAGINAL';
UPDATE sa_indicator SET target_id = 3162 WHERE ind_code = 'SYS_FEMALE_BREAST';
UPDATE sa_indicator SET target_id = 3146 WHERE ind_code = 'SYS_MALE_ED';
UPDATE sa_indicator SET target_id = 3149 WHERE ind_code = 'SYS_MALE_PROSTATE_HYPERPLASIA';
UPDATE sa_indicator SET target_id = 3151 WHERE ind_code = 'SYS_MALE_PROSTATE_CALCIFICATION';
UPDATE sa_indicator SET target_id = 3150 WHERE ind_code = 'SYS_MALE_PROSTATE_INFLAMMATION';
UPDATE sa_indicator SET target_id = 3137 WHERE ind_code = 'SYS_IMMUNE_LYMPH';
UPDATE sa_indicator SET target_id = 3140 WHERE ind_code = 'SYS_IMMUNE_TONSIL';
UPDATE sa_indicator SET target_id = 3139 WHERE ind_code = 'SYS_IMMUNE_GLOBULIN';
UPDATE sa_indicator SET target_id = 3141 WHERE ind_code = 'SYS_IMMUNE_RESPIRATORY';
UPDATE sa_indicator SET target_id = 3138 WHERE ind_code = 'SYS_IMMUNE_SPLEEN';
UPDATE sa_indicator SET target_id = 3142 WHERE ind_code = 'SYS_IMMUNE_DIGESTIVE';

-- 清理不在口径内的登记，避免留下悬空映射
UPDATE sa_indicator SET target_id = NULL
WHERE target_id IS NOT NULL AND ind_code NOT LIKE 'SYS\_%';

COMMIT;
