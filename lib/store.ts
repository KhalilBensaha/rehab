// Simple client-side store for prototype persistence
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Locale } from "./i18n"

export type ProductStatus = "in stock" | "delivery" | "delivered" | "canceled"

export interface Company {
  id: string
  name: string
  benefit: number
}

export interface Product {
  id: string
  clientName: string
  companyName: string
  phone: string
  price: number
  status: ProductStatus
  workerId?: string
}

export interface Worker {
  id: string
  name: string
  phone: string
  profilePic: string
  certificates: string
  commission: number // Percentage or fixed price as per text
}

export interface Admin {
  id: string
  name: string
  email: string
  role: "admin" | "superadmin"
}

interface RehabState {
  admins: Admin[]
  companies: Company[]
  products: Product[]
  workers: Worker[]
  currentUser: Admin | null
  setCurrentUser: (user: Admin | null) => void
  addAdmin: (admin: Admin) => void
  removeAdmin: (id: string) => void
  updateAdminRole: (id: string, role: "admin" | "superadmin") => void
  addCompany: (company: Company) => void
  removeCompany: (id: string) => void
  addProduct: (product: Product) => void
  updateProductStatus: (id: string, status: ProductStatus) => void
  assignProduct: (productId: string, workerId: string) => void
  detachProduct: (productId: string) => void
  addWorker: (worker: Worker) => void
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useStore = create<RehabState>()(
  persist(
    (set) => ({
      admins: [
        { id: "1", name: "Super Admin", email: "super@rehab.com", role: "superadmin" },
        { id: "2", name: "Delivery Admin", email: "admin@rehab.com", role: "admin" },
      ],
      companies: [
        { id: "c1", name: "Global Logistics", benefit: 5.5 },
        { id: "c2", name: "Express Way", benefit: 4.2 },
      ],
      products: [],
      workers: [],
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      addAdmin: (admin) => set((state) => ({ admins: [...state.admins, admin] })),
      removeAdmin: (id) => set((state) => ({ admins: state.admins.filter((a) => a.id !== id) })),
      updateAdminRole: (id, role) =>
        set((state) => ({
          admins: state.admins.map((a) => (a.id === id ? { ...a, role } : a)),
        })),
      addCompany: (company) => set((state) => ({ companies: [...state.companies, company] })),
      removeCompany: (id) => set((state) => ({ companies: state.companies.filter((c) => c.id !== id) })),
      addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
      updateProductStatus: (id, status) =>
        set((state) => ({
          products: state.products.map((p) => (p.id === id ? { ...p, status } : p)),
        })),
      assignProduct: (productId, workerId) =>
        set((state) => ({
          products: state.products.map((p) => (p.id === productId ? { ...p, workerId, status: "delivery" } : p)),
        })),
      detachProduct: (productId) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, workerId: undefined, status: "in stock" } : p,
          ),
        })),
      addWorker: (worker) => set((state) => ({ workers: [...state.workers, worker] })),
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "rehab-storage" },
  ),
)
