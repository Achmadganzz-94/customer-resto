import type { MenuItem } from "../api/menuApi";

export interface CartItem {
  menu: MenuItem;
  quantity: number;
  note?: string;
}
