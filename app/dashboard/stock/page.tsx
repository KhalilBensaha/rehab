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
import { Plus, Search, Filter, Upload, Trash2 } from "lucide-react"

type BulkItem = {
  trackingId: string
  clientName: string
  phone: string
  price: number
  exists?: boolean
  duplicateInUpload?: boolean
}

function StockContent() {
  const { currentUser, locale, setProducts: setStoreProducts, products: storeProducts } = useStore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [filterCompany, setFilterCompany] = useState<string>("all")
  const [search, setSearch] = useState("")

  const [products, setProducts] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])

  const [bulkCompanyId, setBulkCompanyId] = useState("")
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState<string>("")

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

  const canBulk = isSuperRole(currentUser?.role) || currentUser?.role === "admin"

  useEffect(() => {
    const load = async () => {
      const [{ data: p }, companiesRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, client_name, phone, price, status, company_id, delivery_worker_id, created_at")
          .order("created_at", { ascending: false }),
        fetch("/api/companies/list"),
      ])
      if (p) setProducts(p)

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

      if (p && companiesData) {
        const companyNameById = new Map<string, string>()
        companiesData.forEach((c: any) => companyNameById.set(String(c.id), c.name))

        setStoreProducts(
          p.map((prod) => ({
            id: String(prod.id),
            clientName: prod.client_name,
            companyName: prod.company_id
              ? companyNameById.get(String(prod.company_id)) || String(prod.company_id)
              : "-",
            phone: prod.phone,
            price: Number(prod.price || 0),
            status: normalizeStatus(prod.status),
            workerId: prod.delivery_worker_id ? String(prod.delivery_worker_id) : undefined,
          })),
        )
      }
    }
    load()
  }, [])

  const resetBulk = () => {
    setBulkCompanyId("")
    setBulkFile(null)
    setBulkItems([])
    setBulkLoading(false)
    setBulkSubmitting(false)
    setBulkError("")
  }

  const handleBulkExtract = async () => {
    if (!bulkCompanyId || !bulkFile) return
    setBulkLoading(true)
    setBulkError("")
    try {
      const formData = new FormData()
      formData.append("file", bulkFile)
      const res = await fetch("/api/products/ocr", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setBulkError(err?.error || "OCR failed")
        setBulkItems([])
        return
      }
      const body = await res.json()
      setBulkItems(Array.isArray(body?.items) ? body.items : [])
    } catch (err) {
      console.error("OCR failed", err)
      setBulkError("OCR failed")
      setBulkItems([])
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkSubmit = async () => {
    if (!bulkCompanyId) return
    const itemsToSubmit = bulkItems.filter((item) => item.trackingId && !item.exists && !item.duplicateInUpload)
    if (itemsToSubmit.length === 0) return
    setBulkSubmitting(true)
    setBulkError("")
    try {
      const res = await fetch("/api/products/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToSubmit, companyId: bulkCompanyId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setBulkError(err?.error || "Bulk insert failed")
        return
      }
      const body = await res.json()
      const inserted = Array.isArray(body?.inserted) ? body.inserted : []
      if (inserted.length > 0) {
        setProducts((prev) => [...inserted, ...prev])
        const companyNameById = new Map<string, string>()
        companies.forEach((c) => companyNameById.set(String(c.id), c.name))
        setStoreProducts([
          ...inserted.map((prod: any) => ({
            id: String(prod.id),
            clientName: prod.client_name,
            companyName: prod.company_id ? companyNameById.get(String(prod.company_id)) || String(prod.company_id) : "-",
            phone: prod.phone,
            price: Number(prod.price || 0),
            status: normalizeStatus(prod.status),
            workerId: prod.delivery_worker_id ? String(prod.delivery_worker_id) : undefined,
          })),
          ...(storeProducts || []),
        ])
      }
      setIsBulkOpen(false)
      resetBulk()
    } catch (err) {
      console.error("Bulk insert failed", err)
      setBulkError("Bulk insert failed")
    } finally {
      setBulkSubmitting(false)
    }
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    const customId = newProduct.productId.trim()
    if (!customId) return
    const payload = {
      id: customId,
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
          const companyName = companies.find((c) => String(c.id) === String(body.product.company_id))?.name
          setStoreProducts([
            {
              id: String(body.product.id),
              clientName: body.product.client_name,
              companyName: body.product.company_id ? companyName || String(body.product.company_id) : "-",
              phone: body.product.phone,
              price: Number(body.product.price || 0),
              status: normalizeStatus(body.product.status),
              workerId: body.product.delivery_worker_id ? String(body.product.delivery_worker_id) : undefined,
            },
            ...(storeProducts || []),
          ])
          return
        }
      }
    } catch (err) {
      console.error("Create product API failed", err)
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        id: customId,
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
      const companyName = companies.find((c) => String(c.id) === String(data.company_id))?.name
      setStoreProducts([
        {
          id: String(data.id),
          clientName: data.client_name,
          companyName: data.company_id ? companyName || String(data.company_id) : "-",
          phone: data.phone,
          price: Number(data.price || 0),
          status: normalizeStatus(data.status),
          workerId: data.delivery_worker_id ? String(data.delivery_worker_id) : undefined,
        },
        ...(storeProducts || []),
      ])
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
          <div className="flex gap-2">
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
                    <Label htmlFor="productId">{t.common.id}</Label>
                    <Input
                      id="productId"
                      type="text"
                      required
                      value={newProduct.productId}
                      onChange={(e) => setNewProduct({ ...newProduct, productId: e.target.value })}
                      placeholder={t.stock.idPlaceholder || "Scan or type ID"}
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
            {canBulk && (
              <Dialog
                open={isBulkOpen}
                onOpenChange={(open) => {
                  setIsBulkOpen(open)
                  if (!open) resetBulk()
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" /> {t.stock.import}
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-screen h-screen max-w-none sm:rounded-none p-4 overflow-auto">
                  <DialogHeader>
                    <DialogTitle>{t.stock.importTitle}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4 min-h-full">
                    <div className="grid gap-2">
                      <Label>{t.stock.company}</Label>
                      <Select value={bulkCompanyId} onValueChange={setBulkCompanyId}>
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
                    <div className="grid gap-2">
                      <Label htmlFor="bulkFile">{t.stock.importFile}</Label>
                      <Input
                        id="bulkFile"
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        disabled={!bulkCompanyId || !bulkFile || bulkLoading}
                        onClick={handleBulkExtract}
                      >
                        {bulkLoading ? t.stock.importExtracting : t.stock.importExtract}
                      </Button>
                      <Button type="button" variant="ghost" onClick={resetBulk}>
                        {t.common.cancel}
                      </Button>
                    </div>
                    {bulkError && <div className="text-sm text-destructive">{bulkError}</div>}
                    {bulkItems.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-sm text-muted-foreground">{t.stock.importPreview}</div>
                        <div className="overflow-auto rounded-md border">
                          <div className="min-w-[1200px]">
                            <Table className="table-fixed">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[180px]">{t.stock.table.id}</TableHead>
                                <TableHead className="w-[220px]">{t.stock.table.client}</TableHead>
                                <TableHead className="w-[200px]">{t.stock.phone}</TableHead>
                                <TableHead className="w-[140px]">{t.stock.table.price}</TableHead>
                                <TableHead className="w-[160px]">{t.stock.importStatus}</TableHead>
                                <TableHead className="w-[90px] text-right">{t.common.actions}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bulkItems.map((item, index) => (
                                <TableRow key={`${item.trackingId}-${index}`}>
                                  <TableCell className="font-mono text-xs">
                                    <Input
                                      className="w-full"
                                      value={item.trackingId}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        setBulkItems((prev) =>
                                          prev.map((p, i) => (i === index ? { ...p, trackingId: value } : p)),
                                        )
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="w-full"
                                      value={item.clientName}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        setBulkItems((prev) =>
                                          prev.map((p, i) => (i === index ? { ...p, clientName: value } : p)),
                                        )
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="w-full"
                                      value={item.phone}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        setBulkItems((prev) =>
                                          prev.map((p, i) => (i === index ? { ...p, phone: value } : p)),
                                        )
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      className="w-full"
                                      type="number"
                                      value={item.price}
                                      onChange={(e) => {
                                        const value = Number.parseFloat(e.target.value)
                                        setBulkItems((prev) =>
                                          prev.map((p, i) =>
                                            i === index ? { ...p, price: Number.isFinite(value) ? value : 0 } : p,
                                          ),
                                        )
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {item.exists && <Badge variant="secondary">{t.stock.importExists}</Badge>}
                                      {item.duplicateInUpload && (
                                        <Badge variant="outline">{t.stock.importDuplicate}</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setBulkItems((prev) => prev.filter((_, i) => i !== index))
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            </Table>
                          </div>
                        </div>
                        <div className="sticky bottom-0 bg-background/95 backdrop-blur px-2 py-3 -mx-2 border-t">
                          <Button
                            type="button"
                            onClick={handleBulkSubmit}
                            disabled={bulkSubmitting || bulkItems.length === 0}
                            className="w-full"
                          >
                            {bulkSubmitting ? t.stock.importSubmitting : t.stock.importSubmit}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      !bulkLoading && <div className="text-sm text-muted-foreground">{t.stock.importEmpty}</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
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
