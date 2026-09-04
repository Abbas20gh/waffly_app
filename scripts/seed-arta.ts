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

// هزینه ارسال بر اساس استان — مبدأ: تهران (قابل ویرایش از پنل مدیریت)
const provinces: Array<[string, number]> = [
  ["تهران", 80_000],
  ["البرز", 90_000],
  ["قم", 110_000],
  ["قزوین", 110_000],
  ["مرکزی", 120_000],
  ["سمنان", 120_000],
  ["مازندران", 125_000],
  ["گلستان", 135_000],
  ["زنجان", 130_000],
  ["همدان", 135_000],
  ["گیلان", 135_000],
  ["اصفهان", 140_000],
  ["لرستان", 140_000],
  ["چهارمحال و بختیاری", 150_000],
  ["کرمانشاه", 150_000],
  ["کردستان", 155_000],
  ["یزد", 150_000],
  ["آذربایجان شرقی", 160_000],
  ["اردبیل", 160_000],
  ["ایلام", 160_000],
  ["خراسان رضوی", 165_000],
  ["فارس", 170_000],
  ["خوزستان", 170_000],
  ["خراسان شمالی", 170_000],
  ["آذربایجان غربی", 175_000],
  ["خراسان جنوبی", 180_000],
  ["کهگیلویه و بویراحمد", 180_000],
  ["کرمان", 190_000],
  ["بوشهر", 190_000],
  ["هرمزگان", 210_000],
  ["سیستان و بلوچستان", 220_000],
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
    create: { key: "originCity", value: "تهران" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "freeShippingThreshold" },
    create: { key: "freeShippingThreshold", value: "10000000" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "cardNumber" },
    create: { key: "cardNumber", value: "" },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "cardOwner" },
    create: { key: "cardOwner", value: "گروه صنعتی آرتا" },
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
