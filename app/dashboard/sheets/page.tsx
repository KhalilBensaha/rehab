"use client"

import { Label } from "@/components/ui/label"
import { useEffect, useState, Suspense } from "react"
import { useStore, type Worker, type ProductStatus } from "@/lib/store"
import { supabase } from "@/lib/supabaseClient"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Search, UserCircle, ExternalLink, ArrowRightLeft } from "lucide-react"
import { useTranslations } from "@/lib/i18n"
import { toast } from "@/hooks/use-toast"

function SheetsContent() {
  const { t } = useTranslations()
  const { workers, products, assignProduct, detachProduct, setWorkers, setProducts, updateProductStatus } = useStore()
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [productToAssign, setProductToAssign] = useState<string>("")
  const [productIdInput, setProductIdInput] = useState<string>("")
  const [assigning, setAssigning] = useState(false)

  const workerProducts = selectedWorker ? products.filter((p) => p.workerId === selectedWorker.id) : []

  const normalizeStatus = (status: string) => (status === "in stock" ? "in_stock" : status)
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
    const newStatus: ProductStatus = "in_stock"
    await supabase.from("products").update({ delivery_worker_id: null, status: newStatus }).eq("id", productId)
    detachProduct(productId)
  }

  const handleMarkDelivered = async (productId: string) => {
    const deliveredAt = new Date().toISOString()
    await supabase
      .from("products")
      .update({ status: "delivered", delivered_at: deliveredAt })
      .eq("id", productId)

    updateProductStatus(productId, "delivered")
    toast({
      title: t("workers.toastDeliveredTitle"),
      description: t("workers.toastDeliveredDesc"),
    })
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
            <div className="space-y-2">
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
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-xl">{t("sheets.sheetTitle", { name: selectedWorker.name })}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t("sheets.commission", { value: selectedWorker.commission.toFixed(2) })}
                    </p>
                  </div>
                  <Button onClick={() => setIsAssignOpen(true)} className="gap-2">
                    <ArrowRightLeft className="h-4 w-4" /> {t("sheets.affect")}
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("sheets.table.id")}</TableHead>
                        <TableHead>{t("sheets.table.client")}</TableHead>
                        <TableHead>{t("sheets.table.company")}</TableHead>
                        <TableHead>{t("sheets.table.price")}</TableHead>
                        <TableHead>{t("sheets.table.status")}</TableHead>
                        <TableHead className="text-right">{t("sheets.table.action")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workerProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.id}</TableCell>
                          <TableCell>{p.clientName}</TableCell>
                          <TableCell>{p.companyName}</TableCell>
                          <TableCell>{p.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {statusLabel(p.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {normalizeStatus(p.status) === "delivered" ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                ✓ {t("stock.status.delivered")}
                              </Badge>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleMarkDelivered(p.id)}
                                >
                                  {t("stock.status.delivered")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleDetach(p.id)}
                                >
                                  {t("sheets.detach")}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {workerProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            {t("sheets.noAssignments")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
