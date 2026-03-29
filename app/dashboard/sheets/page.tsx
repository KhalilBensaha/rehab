"use client"

import { Label } from "@/components/ui/label"
import { useEffect, useMemo, useState, Suspense } from "react"
import { useStore, type Worker, type ProductStatus } from "@/lib/store"
import { supabase } from "@/lib/supabaseClient"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { addTimelineEvent } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, UserCircle, ExternalLink, ArrowRightLeft } from "lucide-react"
import { useTranslations } from "@/lib/i18n"
import { toast } from "@/hooks/use-toast"

type SheetStatusChoice = ProductStatus | "detached"

const DETACHED_HISTORY_STORAGE_KEY = "sheets.detachedHistoryByWorker.v1"

function SheetsContent() {
  const { t, locale, dir } = useTranslations()
  const { workers, products, assignProduct, detachProduct, setWorkers, setProducts, updateProductStatus } = useStore()
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [productToAssign, setProductToAssign] = useState<string>("")
  const [productIdInput, setProductIdInput] = useState<string>("")
  const [assigning, setAssigning] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusDrafts, setStatusDrafts] = useState<Record<string, SheetStatusChoice>>({})
  const [validating, setValidating] = useState(false)
  const [sheetTab, setSheetTab] = useState<"delivery" | "history">("delivery")
  const [detachedHistoryByWorker, setDetachedHistoryByWorker] = useState<Record<string, string[]>>({})

  const workerProducts = selectedWorker ? products.filter((p) => p.workerId === selectedWorker.id) : []
  const deliveryProducts = workerProducts.filter((p) => normalizeStatus(p.status) === "delivery")
  const detachedHistoryProducts = useMemo(() => {
    if (!selectedWorker) return []
    const ids = detachedHistoryByWorker[selectedWorker.id] || []
    return ids
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is (typeof products)[number] => Boolean(p))
  }, [selectedWorker, detachedHistoryByWorker, products])
  const historyProducts = useMemo(() => {
    const list = workerProducts.filter((p) => {
      const status = normalizeStatus(p.status)
      return status === "delivered" || status === "canceled"
    })
    const byId = new Map<string, (typeof products)[number]>()
    list.forEach((p) => byId.set(p.id, p))
    detachedHistoryProducts.forEach((p) => byId.set(p.id, p))
    return Array.from(byId.values())
  }, [workerProducts, detachedHistoryProducts])
  const allSelected = deliveryProducts.length > 0 && selectedIds.size === deliveryProducts.length

  function normalizeStatus(status: string) {
    return status === "in stock" ? "in_stock" : status
  }
  const getEffectiveStatus = (product: (typeof products)[number]): SheetStatusChoice => {
    const drafted = statusDrafts[product.id]
    if (drafted) return drafted
    if (!selectedWorker || product.workerId !== selectedWorker.id) return "detached"
    return normalizeStatus(product.status) as ProductStatus
  }
  const statusLabel = (status: string) => {
    const normalized = normalizeStatus(status)
    if (normalized === "in_stock") return t("stock.status.inStock")
    if (normalized === "delivery") return t("stock.status.delivery")
    if (normalized === "delivered") return t("stock.status.delivered")
    if (normalized === "canceled") return t("stock.status.canceled")
    return normalized.replace("_", " ")
  }

  const availableProducts = products.filter((p) => normalizeStatus(p.status) === "in_stock" && !p.workerId)

  useEffect(() => {
    const load = async () => {
      const [{ data: workersData }, { data: productsData }, { data: companiesData }] = await Promise.all([
        supabase
          .from("delivery_workers")
          .select("id, name, phone, profile_image_url, certificate_image_url, product_fee"),
        supabase
          .from("products")
          .select("id, client_name, phone, price, status, company_id, delivery_worker_id"),
        supabase.from("companies").select("id, name"),
      ])

      if (workersData) {
        setWorkers(
          workersData.map((w) => ({
            id: String(w.id),
            name: w.name,
            phone: w.phone,
            profilePic: w.profile_image_url || "",
            certificates: w.certificate_image_url || "",
            commission: Number(w.product_fee || 0),
          })),
        )
      }
      
      if (productsData) {
        const companyNameById = new Map<string, string>()
        companiesData?.forEach((c) => companyNameById.set(String(c.id), c.name))

        setProducts(
          productsData.map((prod) => ({
            id: String(prod.id),
            clientName: prod.client_name,
            companyName: prod.company_id
              ? companyNameById.get(String(prod.company_id)) || String(prod.company_id)
              : "-",
            phone: prod.phone,
            price: Number(prod.price || 0),
            status: normalizeStatus(prod.status || "in_stock") as any,
            workerId: prod.delivery_worker_id ? String(prod.delivery_worker_id) : undefined,
          })),
        )
      }
    }

    load()
  }, [setProducts, setWorkers])

  useEffect(() => {
    setSelectedIds(new Set())
    setStatusDrafts({})
    setSheetTab("delivery")
  }, [selectedWorker?.id])

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(DETACHED_HISTORY_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") {
        setDetachedHistoryByWorker(parsed)
      }
    } catch {
      // ignore invalid value
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(DETACHED_HISTORY_STORAGE_KEY, JSON.stringify(detachedHistoryByWorker))
  }, [detachedHistoryByWorker])

  const handleAssign = async (explicitId?: string) => {
    const productId = (explicitId || productToAssign).trim()
    if (!selectedWorker || !productId) return
    const product = products.find((p) => p.id === productId)
    if (!product) {
      toast({
        variant: "destructive",
        title: t("workers.toastUpdateFailedTitle"),
        description: t("sheets.productNotFound"),
      })
      return
    }
    if (product.workerId) {
      toast({
        variant: "destructive",
        title: t("workers.toastUpdateFailedTitle"),
        description: t("sheets.productAlreadyAssigned"),
      })
      return
    }
    setAssigning(true)
    try {
      await supabase
        .from("products")
        .update({ delivery_worker_id: selectedWorker.id, status: "delivery" })
        .eq("id", productId)

      assignProduct(productId, selectedWorker.id)
    } finally {
      setAssigning(false)
      setIsAssignOpen(false)
      setProductToAssign("")
      setProductIdInput("")
    }
  }

  const handleDetach = async (productId: string) => {
    const prev = products.find((p) => p.id === productId)
    const oldStatus = prev ? normalizeStatus(prev.status) : "delivery"
    const newStatus: ProductStatus = "in_stock"
    await supabase.from("products").update({ delivery_worker_id: null, status: newStatus }).eq("id", productId)
    detachProduct(productId)
    addTimelineEvent(productId, oldStatus, newStatus, "sheets")
  }

  const handleMarkDelivered = async (productId: string) => {
    const prev = products.find((p) => p.id === productId)
    const oldStatus = prev ? normalizeStatus(prev.status) : "delivery"
    const deliveredAt = new Date().toISOString()
    await supabase
      .from("products")
      .update({ status: "delivered", delivered_at: deliveredAt })
      .eq("id", productId)

    updateProductStatus(productId, "delivered")
    addTimelineEvent(productId, oldStatus, "delivered", "sheets")
    toast({
      title: t("workers.toastDeliveredTitle"),
      description: t("workers.toastDeliveredDesc"),
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set())
      return
    }
    const next = new Set(deliveryProducts.map((p) => p.id))
    setSelectedIds(next)
  }

  const toggleRow = (productId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(productId)
      } else {
        next.delete(productId)
      }
      return next
    })
  }

  const handlePrint = (mode: "selected" | "all") => {
    if (!selectedWorker) return
    const baseItems = sheetTab === "history" ? historyProducts : deliveryProducts
    const items = mode === "all" ? baseItems : baseItems.filter((p) => selectedIds.has(p.id))
    if (items.length === 0) {
      toast({
        variant: "destructive",
        title: t("sheets.printNoSelection"),
        description: t("sheets.printNoSelectionDesc"),
      })
      return
    }

    const dateText = new Date().toLocaleString(locale || "en")
    const html = `<!doctype html>
<html dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <title>${t("sheets.printTitle")}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 4px 0; }
      .muted { color: #666; font-size: 12px; }
      .info { margin: 12px 0 16px 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; text-align: ${dir === "rtl" ? "right" : "left"}; }
      th { background: #f5f5f5; }
      .right { text-align: ${dir === "rtl" ? "left" : "right"}; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <h1>${t("sheets.printTitle")}</h1>
    <div class="muted">${dateText}</div>
    <div class="info">
      <div><strong>${t("sheets.workerName")}:</strong> ${selectedWorker.name}</div>
      <div><strong>${t("sheets.workerPhone")}:</strong> ${selectedWorker.phone || "-"}</div>
      <div><strong>${t("sheets.printCount")}:</strong> ${items.length}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>${t("sheets.table.id")}</th>
          <th>${t("sheets.table.client")}</th>
          <th>${t("sheets.table.company")}</th>
          <th>${t("stock.phone")}</th>
          <th>${t("sheets.table.price")}</th>
          <th>${t("sheets.table.status")}</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (p) => `
          <tr>
            <td>${p.id}</td>
            <td>${p.clientName}</td>
            <td>${p.companyName}</td>
            <td>${p.phone || "-"}</td>
            <td class="right">${Number(p.price || 0).toFixed(2)}</td>
            <td>${statusLabel(p.status)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </body>
</html>`

    const printWindow = window.open("", "_blank", "width=1024,height=768")
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  const handleValidateSheet = async () => {
    if (!selectedWorker || Object.keys(statusDrafts).length === 0) return
    setValidating(true)
    const detachedIds: string[] = []

    try {
      for (const [productId, nextStatus] of Object.entries(statusDrafts)) {
        const prev = products.find((p) => p.id === productId)
        const oldStatus = prev ? normalizeStatus(prev.status) : "delivery"

        if (nextStatus === "detached") {
          await supabase.from("products").update({ delivery_worker_id: null, status: "in_stock" }).eq("id", productId)
          detachProduct(productId)
          addTimelineEvent(productId, oldStatus, "in_stock", "sheets")
          detachedIds.push(productId)
          continue
        }

        const payload: Record<string, any> = { status: nextStatus }
        if (nextStatus === "delivered") {
          payload.delivered_at = new Date().toISOString()
        }
        if (nextStatus === "in_stock") {
          payload.delivery_worker_id = null
        }

        await supabase.from("products").update(payload).eq("id", productId)
        if (nextStatus === "in_stock") {
          detachProduct(productId)
        } else {
          updateProductStatus(productId, nextStatus)
        }
        addTimelineEvent(productId, oldStatus, nextStatus, "sheets")
      }

      if (detachedIds.length > 0) {
        setDetachedHistoryByWorker((prev) => {
          const previous = prev[selectedWorker.id] || []
          return {
            ...prev,
            [selectedWorker.id]: Array.from(new Set([...detachedIds, ...previous])),
          }
        })
      }

      setStatusDrafts({})
      setSelectedIds(new Set())
      setSheetTab("delivery")

      toast({
        title: t("sheets.validateSuccessTitle") || "Sheet validated",
        description: t("sheets.validateSuccessDesc") || "Statuses were updated successfully.",
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("workers.toastUpdateFailedTitle"),
        description: err?.message || t("workers.toastUpdateFailedDesc"),
      })
    } finally {
      setValidating(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("sheets.title")}</h1>
          <p className="text-muted-foreground">{t("sheets.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Workers List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" /> {t("sheets.team")}
            </h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
              {workers.map((worker) => (
                <Card
                  key={worker.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedWorker?.id === worker.id ? "border-primary bg-primary/5" : ""}`}
                  onClick={() => setSelectedWorker(worker)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{worker.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {products.filter((p) => p.workerId === worker.id).length} {t("sheets.assignments")}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-50" />
                  </CardContent>
                </Card>
              ))}
              {workers.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-8">{t("sheets.emptyWorkers")}</p>
              )}
            </div>
          </div>
          
          {/* Sheet Detail */}
          <div className="lg:col-span-2">
            {selectedWorker ? (
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">{t("sheets.sheetTitle", { name: selectedWorker.name })}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t("sheets.commission", { value: selectedWorker.commission.toFixed(2) })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={workerProducts.length === 0}
                      onClick={() => handlePrint("all")}
                    >
                      {t("sheets.printAll")}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={selectedIds.size === 0}
                      onClick={() => handlePrint("selected")}
                    >
                      {t("sheets.printSelected")}
                    </Button>
                    <Button onClick={() => setIsAssignOpen(true)} className="gap-2">
                      <ArrowRightLeft className="h-4 w-4" /> {t("sheets.affect")}
                    </Button>
                    <Button
                      variant="default"
                      disabled={Object.keys(statusDrafts).length === 0 || validating}
                      onClick={handleValidateSheet}
                    >
                      {validating ? t("common.loading") : t("sheets.validateResults") || "Validate results"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={sheetTab} onValueChange={(v) => setSheetTab(v as "delivery" | "history")}>
                    <TabsList className="mb-4 grid grid-cols-2 w-full">
                      <TabsTrigger value="delivery">{t("sheets.inDeliveryTab") || "In delivery"}</TabsTrigger>
                      <TabsTrigger value="history">{t("sheets.historyTab") || "Validated history"}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="delivery">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={allSelected}
                                onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                                aria-label={t("sheets.selectAll")}
                              />
                            </TableHead>
                            <TableHead>{t("sheets.table.id")}</TableHead>
                            <TableHead>{t("sheets.table.client")}</TableHead>
                            <TableHead>{t("sheets.table.company")}</TableHead>
                            <TableHead>{t("sheets.table.price")}</TableHead>
                            <TableHead>{t("sheets.table.status")}</TableHead>
                            <TableHead className="text-right">{t("sheets.table.action")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deliveryProducts.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(p.id)}
                                  onCheckedChange={(checked) => toggleRow(p.id, Boolean(checked))}
                                  aria-label={p.id}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-xs">{p.id}</TableCell>
                              <TableCell>{p.clientName}</TableCell>
                              <TableCell>{p.companyName}</TableCell>
                              <TableCell>{p.price.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {statusLabel(getEffectiveStatus(p))}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end">
                                  <Select
                                    value={getEffectiveStatus(p)}
                                    onValueChange={(value) =>
                                      setStatusDrafts((prev) => ({ ...prev, [p.id]: value as SheetStatusChoice }))
                                    }
                                  >
                                    <SelectTrigger className="w-37.5 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="delivery">{t("stock.status.delivery")}</SelectItem>
                                      <SelectItem value="in_stock">{t("stock.status.inStock")}</SelectItem>
                                      <SelectItem value="delivered">{t("stock.status.delivered")}</SelectItem>
                                      <SelectItem value="canceled">{t("stock.status.canceled")}</SelectItem>
                                      <SelectItem value="detached">{t("sheets.detachedStatus") || "Detached"}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {deliveryProducts.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                {t("sheets.noDeliveryProducts") || "No in-delivery products."}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="history">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("sheets.table.id")}</TableHead>
                            <TableHead>{t("sheets.table.client")}</TableHead>
                            <TableHead>{t("sheets.table.company")}</TableHead>
                            <TableHead>{t("sheets.table.price")}</TableHead>
                            <TableHead>{t("sheets.table.status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyProducts.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs">{p.id}</TableCell>
                              <TableCell>{p.clientName}</TableCell>
                              <TableCell>{p.companyName}</TableCell>
                              <TableCell>{p.price.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="capitalize">
                                  {p.workerId === selectedWorker.id
                                    ? statusLabel(normalizeStatus(p.status))
                                    : t("sheets.detachedStatus") || "Detached"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {historyProducts.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                {t("sheets.noHistoryProducts") || "No validated history yet."}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-20 text-muted-foreground">
                <Search className="h-10 w-10 mb-2 opacity-20" />
                <p>{t("sheets.selectWorker")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Assign Modal */}
        <Dialog
          open={isAssignOpen}
          onOpenChange={(open) => {
            setIsAssignOpen(open)
            if (!open) {
              setProductToAssign("")
              setProductIdInput("")
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("sheets.modalTitle", { name: selectedWorker?.name || "" })}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("sheets.selectProduct")}</Label>
                <Select onValueChange={setProductToAssign}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("sheets.searchPlaceholder") || undefined} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.id} - {p.clientName} ({p.companyName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignById">{t("sheets.assignById")}</Label>
                <Input
                  id="assignById"
                  value={productIdInput}
                  onChange={(e) => setProductIdInput(e.target.value)}
                  placeholder={t("sheets.assignByIdPlaceholder")}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAssign(productIdInput)
                    }
                  }}
                />
              </div>
              <Button
                className="w-full"
                disabled={assigning || (!productToAssign && !productIdInput)}
                onClick={() => handleAssign(productIdInput || productToAssign)}
              >
                {assigning ? t("sheets.assigning") : t("sheets.confirm")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

export default function SheetsPage() {
  return (
    <Suspense fallback={null}>
      <SheetsContent />
    </Suspense>
  )
}
