"use client"

import type React from "react"
import { useEffect, useState, Suspense } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useStore, type ProductStatus } from "@/lib/store"
import { translations } from "@/lib/i18n"
import { isSuperRole } from "@/lib/utils"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Filter } from "lucide-react"

function StockContent() {
  const { currentUser, locale, setProducts: setStoreProducts } = useStore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [filterCompany, setFilterCompany] = useState<string>("all")
  const [search, setSearch] = useState("")

  const [products, setProducts] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])

  const [newProduct, setNewProduct] = useState({
    productId: "",
    clientName: "",
    companyId: "",
    phone: "",
    price: 0,
  })

  const t = translations[locale || "en"]

  const STATUS_LABELS: Record<ProductStatus, string> = {
    in_stock: t.stock.status.inStock,
    delivery: t.stock.status.delivery,
    delivered: t.stock.status.delivered,
    canceled: t.stock.status.canceled,
  }

  const normalizeStatus = (status: string): ProductStatus => {
    if (status === "in stock") return "in_stock"
    if (status === "in_stock" || status === "delivery" || status === "delivered" || status === "canceled") {
      return status as ProductStatus
    }
    return "in_stock"
  }

  useEffect(() => {
    const load = async () => {
      const [{ data: p }, companiesRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, client_name, phone, price, status, company_id, delivery_worker_id, created_at")
          .order("created_at", { ascending: false }),
        fetch("/api/companies/list"),
      ])
      if (p) {
        setProducts(p)
        setStoreProducts(
          p.map((prod) => ({
            id: String(prod.id),
            clientName: prod.client_name,
            companyName: prod.company_id ? String(prod.company_id) : "-",
            phone: prod.phone,
            price: Number(prod.price || 0),
            status: normalizeStatus(prod.status),
            workerId: prod.delivery_worker_id ? String(prod.delivery_worker_id) : undefined,
          })),
        )
      }

      let companiesData: any[] | undefined
      try {
        const body = await companiesRes.json()
        if (companiesRes.ok) {
          companiesData = body.companies
        }
      } catch (err) {
        console.error("Failed to parse companies list", err)
      }

      if (!companiesData) {
        const { data: c } = await supabase
          .from("companies")
          .select("id, name, combenef")
          .order("created_at", { ascending: false })
        companiesData = c || []
      }

      setCompanies(companiesData)
    }
    load()
  }, [])

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    const customId = newProduct.productId.trim() || null
    const payload = {
      id: customId || undefined,
      clientName: newProduct.clientName,
      phone: newProduct.phone,
      price: newProduct.price,
      companyId: newProduct.companyId || null,
    }

    try {
      const res = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const body = await res.json()
        if (body.product) {
          setProducts((prev) => [body.product, ...prev])
          setIsAddOpen(false)
          setNewProduct({ productId: "", clientName: "", companyId: "", phone: "", price: 0 })
          return
        }
      }
    } catch (err) {
      console.error("Create product API failed", err)
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        ...(customId ? { id: customId } : {}),
        client_name: newProduct.clientName,
        phone: newProduct.phone,
        price: newProduct.price,
        status: "in_stock",
        company_id: newProduct.companyId || null,
      })
      .select()
      .single()
    if (!error && data) {
      setProducts((prev) => [data, ...prev])
      setIsAddOpen(false)
      setNewProduct({ productId: "", clientName: "", companyId: "", phone: "", price: 0 })
    } else if (error) {
      console.error("Create product failed", error)
    }
  }

  const handleStatusChange = async (id: number, status: ProductStatus) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
    await supabase.from("products").update({ status }).eq("id", id)
  }

  const handleDeleteProduct = async (id: number) => {
    await supabase.from("products").delete().eq("id", id)
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const canDelete = isSuperRole(currentUser?.role) || currentUser?.role === "admin"

  const filteredProducts = products.filter((p) => {
    const matchesCompany = filterCompany === "all" || String(p.company_id) === filterCompany
    const matchesSearch =
      (p.client_name || "").toLowerCase().includes(search.toLowerCase()) || String(p.id).includes(search)
    return matchesCompany && matchesSearch
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t.stock.title}</h1>
            <p className="text-muted-foreground">{t.stock.subtitle}</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> {t.stock.add}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.stock.dialogTitle}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddProduct} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="productId">{t.common.id} ({t.common.optional || "optional"})</Label>
                  <Input
                    id="productId"
                    type="text"
                    value={newProduct.productId}
                    onChange={(e) => setNewProduct({ ...newProduct, productId: e.target.value })}
                    placeholder={t.stock.idPlaceholder || "Auto-assigned if left blank (letters or numbers allowed)"}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client">{t.stock.client}</Label>
                  <Input
                    id="client"
                    required
                    value={newProduct.clientName}
                    onChange={(e) => setNewProduct({ ...newProduct, clientName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t.stock.company}</Label>
                  <Select required onValueChange={(val) => setNewProduct({ ...newProduct, companyId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.stock.company} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">{t.stock.phone}</Label>
                    <Input
                      id="phone"
                      required
                      value={newProduct.phone}
                      onChange={(e) => setNewProduct({ ...newProduct, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">{t.stock.price}</Label>
                    <Input
                      id="price"
                      type="number"
                      required
                      value={newProduct.price}
                      onChange={(e) => {
                        const val = Number.parseFloat(e.target.value)
                        setNewProduct({ ...newProduct, price: Number.isFinite(val) ? val : 0 })
                      }}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-4">
                  {t.stock.submit}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4 items-center bg-card p-4 rounded-lg border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.stock.search}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t.stock.filterAll} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.stock.filterAll}</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.stock.table.id}</TableHead>
                <TableHead>{t.stock.table.client}</TableHead>
                <TableHead>{t.stock.table.company}</TableHead>
                <TableHead>{t.stock.table.price}</TableHead>
                <TableHead>{t.stock.table.status}</TableHead>
                <TableHead className="text-right">{t.stock.table.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.client_name}</div>
                      <div className="text-xs text-muted-foreground">{p.phone}</div>
                    </TableCell>
                    <TableCell>{companies.find((c) => c.id === p.company_id)?.name || "-"}</TableCell>
                    <TableCell>{Number(p.price || 0).toFixed(2)} {t.common.currency}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          normalizeStatus(p.status) === "delivered"
                            ? "secondary"
                            : normalizeStatus(p.status) === "canceled"
                              ? "destructive"
                              : normalizeStatus(p.status) === "delivery"
                                ? "outline"
                                : "default"
                        }
                        className="capitalize"
                      >
                        {STATUS_LABELS[normalizeStatus(p.status)]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Select
                          value={normalizeStatus(p.status)}
                          onValueChange={(val) => handleStatusChange(p.id, normalizeStatus(val))}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in_stock">{t.stock.status.inStock}</SelectItem>
                            <SelectItem value="delivery">{t.stock.status.delivery}</SelectItem>
                            <SelectItem value="delivered">{t.stock.status.delivered}</SelectItem>
                            <SelectItem value="canceled">{t.stock.status.canceled}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={!canDelete}
                          onClick={() => handleDeleteProduct(p.id)}
                        >
                          {t.common.delete}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {t.stock.empty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function StockPage() {
  return (
    <Suspense fallback={null}>
      <StockContent />
    </Suspense>
  )
}
