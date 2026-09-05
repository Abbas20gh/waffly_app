// ===== یک‌بار مصرف: به‌روزرسانی مبدأ به یزد + کارت ایران زمین + هزینه ارسال =====
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// هم‌سو با seed-arta.ts — مبدأ: یزد
const provinces: Array<[string, number]> = [
  ["یزد", 80_000],
  ["اصفهان", 100_000],
  ["کرمان", 110_000],
  ["چهارمحال و بختیاری", 115_000],
  ["فارس", 120_000],
  ["هرمزگان", 120_000],
  ["خراسان جنوبی", 120_000],
  ["قم", 140_000],
  ["سمنان", 140_000],
  ["مرکزی", 145_000],
  ["تهران", 150_000],
  ["البرز", 155_000],
  ["قزوین", 155_000],
  ["خوزستان", 160_000],
  ["کهگیلویه و بویراحمد", 165_000],
  ["لرستان", 165_000],
  ["بوشهر", 170_000],
  ["زنجان", 170_000],
  ["خراسان رضوی", 170_000],
  ["مازندران", 175_000],
  ["همدان", 175_000],
  ["خراسان شمالی", 180_000],
  ["آذربایجان شرقی", 185_000],
  ["گیلان", 185_000],
  ["گلستان", 185_000],
  ["ایلام", 185_000],
  ["اردبیل", 190_000],
  ["کرمانشاه", 190_000],
  ["سیستان و بلوچستان", 190_000],
  ["آذربایجان غربی", 200_000],
  ["کردستان", 200_000],
];

const settings: Array<[string, string]> = [
  ["originCity", "یزد"],
  ["cardNumber", "6063731255582299"],
  ["cardOwner", "علی سبیلی"],
  ["cardBank", "بانک ایران زمین"],
];

async function main() {
  for (const [key, value] of settings) {
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  let updated = 0;
  for (const [name, cost] of provinces) {
    const res = await db.province.updateMany({ where: { name }, data: { shippingCost: cost } });
    updated += res.count;
  }

  const prov = await db.province.count();
  console.log(`settings updated: ${settings.length}, provinces updated: ${updated}/${prov}`);
  if (prov !== 31) console.warn("⚠️ تعداد استان‌ها ۳۱ نیست — seed را اجرا کنید");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
