// ===== تایپ‌های مشترک فروشگاه =====
// نام فیلدها با Waffly همخوان نگه داشته شده (pricePerUnit، boxCount، …)
// تا اتصال آینده دو سیستم بی‌دردسر باشد.

export interface ProductDTO {
  id: string;
  slug: string;
  name: string;
  sizeLabel: string;
  pricePerUnit: number;
  unitsPerBox: number;
  essenceEnabled: boolean;
  imageUrl: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
}

export interface ProvinceDTO {
  id: string;
  name: string;
  shippingCost: number;
}

export interface OrderItemDTO {
  productId: string;
  name: string;
  sizeLabel: string;
  essence: boolean;
  essenceLabel: string;
  boxCount: number; // ← هم‌نام Waffly
  units: number;
  unitPrice: number;
  boxPrice: number;
  lineTotal: number;
  wholesale: boolean;
}

export interface OrderDTO {
  id: string;
  serial: number;
  customerName: string;
  phone: string;
  provinceName: string;
  cityName: string;
  address: string;
  postalCode: string | null;
  note: string | null;
  items: OrderItemDTO[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export interface TrackResult {
  found: true;
  order: Pick<
    OrderDTO,
    | "serial"
    | "customerName"
    | "status"
    | "items"
    | "subtotal"
    | "shippingCost"
    | "total"
    | "paymentMethod"
    | "provinceName"
    | "cityName"
    | "createdAt"
  >;
}
