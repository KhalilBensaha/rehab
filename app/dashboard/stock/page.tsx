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
import { toast } from "@/hooks/use-toast"

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
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)

  const [products, setProducts] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [workers, setWorkers] = useState<any[]>([])

  const [bulkCompanyId, setBulkCompanyId] = useState("")
  const [bulkFiles, setBulkFiles] = useState<File[]>([])
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })
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
      const [{ data: p }, companiesRes, { data: workersData }] = await Promise.all([
        supabase
          .from("products")
          .select("id, client_name, phone, price, status, company_id, delivery_worker_id, created_at")
          .order("created_at", { ascending: false }),
        fetch("/api/companies/list"),
        supabase.from("delivery_workers").select("id, name"),
      ])
      if (p) setProducts(p)
      if (workersData) setWorkers(workersData)

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
    setBulkFiles([])
    setBulkItems([])
    setBulkLoading(false)
    setBulkProgress({ current: 0, total: 0 })
    setBulkSubmitting(false)
    setBulkError("")
  }

  const handleBulkExtract = async () => {
    if (!bulkCompanyId || bulkFiles.length === 0) return
    setBulkLoading(true)
    setBulkError("")
    setBulkItems([])
    setBulkProgress({ current: 0, total: bulkFiles.length })

    const allItems: BulkItem[] = []
    const errors: string[] = []

    for (let i = 0; i < bulkFiles.length; i++) {
      setBulkProgress({ current: i + 1, total: bulkFiles.length })
      try {
        const formData = new FormData()
        formData.append("file", bulkFiles[i])
        formData.append("companyId", bulkCompanyId)
        const res = await fetch("/api/products/ocr", {
          method: "POST",
          body: formData,
        })
        if (!res.ok) {
          errors.push(bulkFiles[i].name)
          continue
        }
        const body = await res.json()
        const items = Array.isArray(body?.items) ? body.items : []
        allItems.push(...items)
      } catch (err) {
        console.error(`OCR failed for ${bulkFiles[i].name}`, err)
        errors.push(bulkFiles[i].name)
      }
    }

    // Deduplicate across all files
    const uniqueMap = new Map<string, BulkItem>()
    allItems.forEach((item) => {
      if (item.trackingId && !uniqueMap.has(item.trackingId)) {
        uniqueMap.set(item.trackingId, item)
      }
    })
    setBulkItems(Array.from(uniqueMap.values()))

    if (errors.length > 0) {
      setBulkError(t.stock.importErrorSummary.replace("{count}", String(errors.length)))
    }
    setBulkLoading(false)
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
        setBulkError(t.stock.importSubmitFailed)
        return
      }
      const body = await res.json()
      const inserted = Array.isArray(body?.inserted) ? body.inserted : []
      const skippedExisting = Array.isArray(body?.skippedExisting) ? body.skippedExisting : []
      if (skippedExisting.length > 0) {
        toast({
          variant: "destructive",
          title: t.stock.duplicateBulkTitle,
          description: t.stock.duplicateBulkDesc.replace("{count}", String(skippedExisting.length)),
        })
      }
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
      setBulkError(t.stock.importSubmitFailed)
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
      const errorBody = await res.json().catch(() => ({}))
      if (
        res.status === 409 ||
        errorBody?.code === "duplicate" ||
        errorBody?.code === "23505" ||
        String(errorBody?.error || "").toLowerCase().includes("duplicate")
      ) {
        toast({
          variant: "destructive",
          title: t.stock.duplicateTitle,
          description: t.stock.duplicateDesc,
        })
        return
      }
    } catch (err) {
      console.error("Create product API failed", err)
      toast({
        variant: "destructive",
        title: t.stock.createFailedTitle,
        description: t.stock.createFailedDesc,
      })
    }

    const { data: existing } = await supabase.from("products").select("id").eq("id", customId).maybeSingle()
    if (existing?.id) {
      toast({
        variant: "destructive",
        title: t.stock.duplicateTitle,
        description: t.stock.duplicateDesc,
      })
      return
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
      if (error.code === "23505" || String(error.message || "").toLowerCase().includes("duplicate")) {
        toast({
          variant: "destructive",
          title: t.stock.duplicateTitle,
          description: t.stock.duplicateDesc,
        })
        return
      }
      console.error("Create product failed", error)
      toast({
        variant: "destructive",
        title: t.stock.createFailedTitle,
        description: t.stock.createFailedDesc,
      })
    }
  }

  const handleStatusChange = async (id: number, status: ProductStatus) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
    setStoreProducts(
      (storeProducts || []).map((p) => (String(p.id) === String(id) ? { ...p, status } : p)),
    )
    await supabase.from("products").update({ status }).eq("id", id)
  }

  const handleDeleteProduct = async (id: number) => {
    await supabase.from("products").delete().eq("id", id)
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const canDelete = isSuperRole(currentUser?.role) || currentUser?.role === "admin"

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleString(locale || "en")
  }

  const normalizeId = (value: string | number | null | undefined) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "")

  const duplicateIdSet = (() => {
    const counts = new Map<string, number>()
    products.forEach((p) => {
      const key = normalizeId(p.id)
      if (!key) return
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const duplicates = new Set<string>()
    counts.forEach((count, key) => {
      if (count > 1) duplicates.add(key)
    })
    return duplicates
  })()

  const filteredProducts = products.filter((p) => {
    const matchesCompany = filterCompany === "all" || String(p.company_id) === filterCompany
    const matchesSearch =
      (p.client_name || "").toLowerCase().includes(search.toLowerCase()) || String(p.id).includes(search)
    const matchesDuplicate = !showDuplicates || duplicateIdSet.has(normalizeId(p.id))
    return matchesCompany && matchesSearch && matchesDuplicate
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
                <DialogContent className="w-screen h-screen max-w-none sm:rounded-none p-6 flex flex-col overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>{t.stock.importTitle}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col flex-1 gap-4 pt-2 min-h-0">
                    {/* Controls row */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-4">
                      <div className="grid gap-1.5 w-full sm:min-w-[200px] sm:w-auto">
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
                      <div className="grid gap-1.5 w-full sm:min-w-[250px] flex-1">
                        <Label htmlFor="bulkFile">{t.stock.importFile}</Label>
                        <Input
                        id="bulkFile"
                        type="file"
                        accept="application/pdf,image/*"
                        multiple
                        onChange={(e) => {
                          const files = e.target.files
                          if (files && files.length > 0) {
                            setBulkFiles((prev) => [...prev, ...Array.from(files)])
                          }
                          e.target.value = ""
                        }}
                      />
                      {bulkFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {bulkFiles.map((file, i) => (
                            <Badge key={`${file.name}-${i}`} variant="secondary" className="gap-1 pr-1">
                              <span className="max-w-[150px] truncate text-xs">{file.name}</span>
                              <button
                                type="button"
                                className="ml-1 rounded-full hover:bg-muted p-0.5"
                                onClick={() => setBulkFiles((prev) => prev.filter((_, j) => j !== i))}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      </div>
                      <div className="flex flex-wrap gap-2 items-end w-full sm:w-auto">
                        <Button
                          type="button"
                          disabled={!bulkCompanyId || bulkFiles.length === 0 || bulkLoading}
                          onClick={handleBulkExtract}
                        >
                          {bulkLoading
                            ? `${t.stock.importExtracting} (${bulkProgress.current}/${bulkProgress.total})`
                            : t.stock.importExtract}
                        </Button>
                        <Button type="button" variant="ghost" onClick={resetBulk}>
                          {t.common.cancel}
                        </Button>
                      </div>
                      {bulkFiles.length > 0 && !bulkLoading && (
                        <span className="text-xs text-muted-foreground sm:self-end pb-2">
                          {bulkFiles.length} file{bulkFiles.length > 1 ? "s" : ""} selected
                        </span>
                      )}
                    </div>
                    {bulkError && <div className="text-sm text-destructive">{bulkError}</div>}
                    {bulkItems.length > 0 ? (
                      <div className="flex flex-col flex-1 min-h-0 gap-2">
                        <div className="text-sm text-muted-foreground">{t.stock.importPreview} ({bulkItems.length})</div>
                        <div className="flex-1 overflow-auto rounded-md border">
                            <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                              <TableRow>
                                <TableHead className="min-w-[160px]">{t.stock.table.id}</TableHead>
                                <TableHead className="min-w-[180px]">{t.stock.table.client}</TableHead>
                                <TableHead className="min-w-[160px]">{t.stock.phone}</TableHead>
                                <TableHead className="min-w-[120px]">{t.stock.table.price}</TableHead>
                                <TableHead className="min-w-[120px]">{t.stock.importStatus}</TableHead>
                                <TableHead className="w-[60px] text-right">{t.common.actions}</TableHead>
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
                        <div className="shrink-0 pt-3 border-t">
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
            <Button
              type="button"
              variant={showDuplicates ? "default" : "outline"}
              className="gap-2"
              onClick={() => setShowDuplicates((prev) => !prev)}
            >
              {t.stock.filterDuplicates || "Filter duplicates"}
            </Button>
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
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedProduct(p)
                      setIsDetailsOpen(true)
                    }}
                  >
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
                          onClick={(e) => e.stopPropagation()}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProduct(p.id)
                          }}
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

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.stock.detailTitle || "Product details"}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-muted-foreground">{t.common.id}</div>
                  <div className="font-mono">{selectedProduct.id}</div>

                  <div className="text-muted-foreground">{t.stock.client}</div>
                  <div>{selectedProduct.client_name || "-"}</div>

                  <div className="text-muted-foreground">{t.stock.company}</div>
                  <div>{companies.find((c) => c.id === selectedProduct.company_id)?.name || "-"}</div>

                  <div className="text-muted-foreground">{t.stock.phone}</div>
                  <div>{selectedProduct.phone || "-"}</div>

                  <div className="text-muted-foreground">{t.stock.price}</div>
                  <div>
                    {Number(selectedProduct.price || 0).toFixed(2)} {t.common.currency}
                  </div>

                  <div className="text-muted-foreground">{t.stock.table.status}</div>
                  <div>{STATUS_LABELS[normalizeStatus(selectedProduct.status)]}</div>

                  <div className="text-muted-foreground">{t.stock.detailCreatedAt || "Added on"}</div>
                  <div>{formatDateTime(selectedProduct.created_at)}</div>

                  <div className="text-muted-foreground">{t.stock.detailAssigned || "Assigned"}</div>
                  <div>
                    {selectedProduct.delivery_worker_id
                      ? t.stock.detailYes || "Yes"
                      : t.stock.detailNo || "No"}
                  </div>

                  {selectedProduct.delivery_worker_id && (
                    <>
                      <div className="text-muted-foreground">{t.stock.detailWorker || "Worker"}</div>
                      <div>
                        {workers.find((w) => String(w.id) === String(selectedProduct.delivery_worker_id))?.name ||
                          selectedProduct.delivery_worker_id}
                      </div>
                    </>
                  )}
                </div>
                <div className="pt-2 flex justify-end">
                  <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                    {t.common.cancel}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
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
