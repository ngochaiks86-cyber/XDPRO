export enum ExpenseCategory {
  LABOR = 'labor',
  CONTRACTED_LABOR = 'contracted_labor',
  RAW_MATERIAL = 'raw_material',
  FINISHING_MATERIAL = 'finishing_material',
  OTHER = 'other'
}

export interface ExpensePayment {
  id: number;
  expense_id: number;
  amount: number;
  note: string;
  date: string;
}

export interface OwnerPayment {
  id: number;
  project_id: number;
  amount: number;
  note: string;
  date: string;
}

export interface Expense {
  id: number;
  project_id: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  quantity?: number;
  unit?: string;
  date: string;
  payments?: ExpensePayment[];
}

export interface ProjectPhoto {
  id: number;
  project_id: number;
  image_url: string;
  description: string;
  date: string;
}

export interface Project {
  id: number;
  name: string;
  budget: number;
  start_date: string;
  status: string;
  image_url?: string;
  expenses?: Expense[];
  photos?: ProjectPhoto[];
  owner_payments?: OwnerPayment[];
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.LABOR]: 'Chi phí nhân công',
  [ExpenseCategory.CONTRACTED_LABOR]: 'Chi phí nhân công khoán',
  [ExpenseCategory.RAW_MATERIAL]: 'Chi phí vật tư thô',
  [ExpenseCategory.FINISHING_MATERIAL]: 'Chi phí vật tư hoàn thiện',
  [ExpenseCategory.OTHER]: 'Chi phí khác'
};
