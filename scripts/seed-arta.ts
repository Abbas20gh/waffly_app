// ===== Seed فروشگاه نان بستنی آرتا (idempotent) =====
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const products = [
  {
    id: "nan-fantezi-kuchak",
    slug: "fantezi-kuchak",
    name: "نان بستنی فانتزی کوچک",
    sizeLabel: "کوچک",
    pricePerUnit: 3800,
    sortOrder: 1,
    description:
      "اندازه جمع‌وجور برای پذیرایی و مهمانی؛ هر جعبه شامل ۲۰۰ عدد نان بستنی فانتزی تازه است.",
  },
  {
    id: "nan-fantezi-motevaset",
    slug: "fantezi-motevaset",
    name: "نان بستنی فانتزی متوسط",
    sizeLabel: "متوسط",
    pricePerUnit: 4000,
    sortOrder: 2,
    description:
      "محبوب‌ترین سایز؛ تعادل عالی میان نان تازه و بستنی خامه‌ای. هر جعبه ۲۰۰ عدد.",
  },
  {
    id: "nan-fantezi-bozorg",
    slug: "fantezi-bozorg",
    name: "نان بستنی فانتزی بزرگ",
    sizeLabel: "بزرگ",
    pricePerUnit: 5000,
    sortOrder: 3,
    description:
      "برای علاقه‌مندان واقعی! سایز بزرگ با بستنی بیشتر. هر جعبه ۲۰۰ عدد.",
  },
  {
    id: "nan-fantezi-kasei",
    slug: "fantezi-kasei",
    name: "نان بستنی فانتزی کاسه‌ای",
    sizeLabel: "کاسه‌ای",
    pricePerUnit: 5000,
    sortOrder: 4,
    description:
      "طرح کاسه‌ای ویژه؛ مناسب بستنی‌فروشی‌ها و توزیع مستقیم. هر جعبه ۲۰۰ عدد.",
  },
];

// هزینه ارسال بر اساس استان — مبدأ: یزد (قابل ویرایش از پنل مدیریت)
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

async function main() {
  for (const p of products) {
    await db.product.upsert({
      where: { id: p.id },
      create: { ...p, imageUrl: `/images/${p.slug}.png`, essenceEnabled: true },
      update: {},
    });
  }

  await db.essence.upsert({
    where: { id: "essence-orange" },
    create: { id: "essence-orange", name: "اسانس پرتقال", active: true },
    update: {},
  });

  for (const [name, cost] of provinces) {
    await db.province.upsert({
      where: { name },
      create: { id: `prov-${name}`, name, shippingCost: cost },
      update: {},
    });
  }

  await db.setting.upsert({
    where: { key: "originCity" },
    create: { key: "originCity", value: "یزد" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "freeShippingThreshold" },
    create: { key: "freeShippingThreshold", value: "10000000" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "cardNumber" },
    create: { key: "cardNumber", value: "6063731255582299" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "cardOwner" },
    create: { key: "cardOwner", value: "علی سبیلی" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "cardBank" },
    create: { key: "cardBank", value: "بانک ایران زمین" },
    update: {},
  });

  await db.orderCounter.upsert({
    where: { id: "main" },
    create: { id: "main", lastNumber: 1000 },
    update: {},
  });

  const counts = {
    products: await db.product.count(),
    provinces: await db.province.count(),
    essences: await db.essence.count(),
    settings: await db.setting.count(),
  };
  console.log("seed done:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
