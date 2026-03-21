"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useStore, type ProductStatus } from "@/lib/store"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Phone, DollarSign, FileCheck, Package, ChartColumnBig, Archive, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useTranslations } from "@/lib/i18n"

type WorkerAnalyticsArchive = {
  id: string
  workerId: string
  workerName: string
  deliveredCount: number
  totalRevenue: number
  workerBenefit: number
  netBenefit: number
  createdAt: string
  signature: string
}

const WORKER_ANALYTICS_ARCHIVE_STORAGE_KEY = "worker-analytics-archives-v1"
const WORKER_ANALYTICS_HIDDEN_STORAGE_KEY = "worker-analytics-hidden-signatures-v1"

export default function WorkersPage() {
  const { t } = useTranslations()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [workers, setWorkers] = useState<Array<any>>([])
  const { setWorkers: setStoreWorkers, setProducts: setStoreProducts, products, updateProductStatus } = useStore()
  const [loading, setLoading] = useState(false)
  const [selectedWorkerForProducts, setSelectedWorkerForProducts] = useState<any | null>(null)
  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false)
  const [selectedWorkerForAnalytics, setSelectedWorkerForAnalytics] = useState<any | null>(null)
  const [isAnalyticsDialogOpen, setIsAnalyticsDialogOpen] = useState(false)
  const [productToAssign, setProductToAssign] = useState("")
  const [productIdInput, setProductIdInput] = useState("")
  const [assigningProduct, setAssigningProduct] = useState(false)
  const [analyticsArchives, setAnalyticsArchives] = useState<WorkerAnalyticsArchive[]>([])
  const [hiddenAnalyticsSignatures, setHiddenAnalyticsSignatures] = useState<Record<string, string>>({})
  const [companyBenefitByName, setCompanyBenefitByName] = useState<Record<string, number>>({})

  const [newWorker, setNewWorker] = useState({
    name: "",
    phone: "",
    commission: 0,
  })

  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [certificateFile, setCertificateFile] = useState<File | null>(null)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<any | null>(null)
  const [editProfileFile, setEditProfileFile] = useState<File | null>(null)
  const [editCertificateFile, setEditCertificateFile] = useState<File | null>(null)

  const workerFeeById = useMemo(() => {
    const map: Record<string, number> = {}
    workers.forEach((worker) => {
      map[String(worker.id)] = Number(worker.product_fee || 0)
    })
    return map
  }, [workers])

  const currentAnalyticsByWorker = useMemo(() => {
    const map: Record<string, { deliveredCount: number; totalRevenue: number; workerBenefit: number; netBenefit: number }> = {}

    products.forEach((product) => {
      if (normalizeStatus(product.status) !== "delivered" || !product.workerId) return
      const workerId = String(product.workerId)
      const companyBenefit = Number(companyBenefitByName[product.companyName] || 0)
      const workerFee = Number(workerFeeById[workerId] || 0)
      const current = map[workerId] || { deliveredCount: 0, totalRevenue: 0, workerBenefit: 0, netBenefit: 0 }

      current.deliveredCount += 1
      current.totalRevenue += companyBenefit
      current.workerBenefit += workerFee
      current.netBenefit += companyBenefit - workerFee
      map[workerId] = current
    })

    return map
  }, [products, companyBenefitByName, workerFeeById])

  const getAnalyticsSignature = (analytics: {
    deliveredCount: number
    totalRevenue: number
    workerBenefit: number
    netBenefit: number
  }) =>
    [
      analytics.deliveredCount,
      analytics.totalRevenue.toFixed(2),
      analytics.workerBenefit.toFixed(2),
      analytics.netBenefit.toFixed(2),
    ].join("|")

  useEffect(() => {
    try {
      const rawArchives = localStorage.getItem(WORKER_ANALYTICS_ARCHIVE_STORAGE_KEY)
      const rawHidden = localStorage.getItem(WORKER_ANALYTICS_HIDDEN_STORAGE_KEY)

      if (rawArchives) {
        const parsed = JSON.parse(rawArchives)
        if (Array.isArray(parsed)) {
          setAnalyticsArchives(parsed)
        }
      }

      if (rawHidden) {
        const parsed = JSON.parse(rawHidden)
        if (parsed && typeof parsed === "object") {
          setHiddenAnalyticsSignatures(parsed)
        }
      }
    } catch {
      // ignore invalid local storage payloads
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(WORKER_ANALYTICS_ARCHIVE_STORAGE_KEY, JSON.stringify(analyticsArchives))
  }, [analyticsArchives])

  useEffect(() => {
    localStorage.setItem(WORKER_ANALYTICS_HIDDEN_STORAGE_KEY, JSON.stringify(hiddenAnalyticsSignatures))
  }, [hiddenAnalyticsSignatures])

  function normalizeStatus(status: string): ProductStatus {
    if (status === "in stock") return "in_stock"
    if (status === "in_stock" || status === "delivery" || status === "delivered" || status === "canceled") {
      return status as ProductStatus
    }
    return "in_stock"
  }

  const statusLabel = (status: string) => {
    const normalized = normalizeStatus(status)
    if (normalized === "in_stock") return t("stock.status.inStock")
    if (normalized === "delivery") return t("stock.status.delivery")
    if (normalized === "delivered") return t("stock.status.delivered")
    if (normalized === "canceled") return t("stock.status.canceled")
    return normalized
  }

  const handleMarkStatus = async (productId: string, status: ProductStatus) => {
    updateProductStatus(productId, status)
    
    const updateData: Record<string, any> = { status }
    
    // If marking as delivered, save the delivery timestamp
    if (status === "delivered") {
      updateData.delivered_at = new Date().toISOString()
    }
    
    await supabase.from("products").update(updateData).eq("id", productId)
    
    if (status === "delivered") {
      toast({
        title: t("workers.toastDeliveredTitle"),
        description: t("workers.toastDeliveredDesc"),
      })
    }
  }

  const handleAssignProduct = async (explicitId?: string) => {
    const productId = (explicitId || productToAssign).trim()
    if (!selectedWorkerForProducts || !productId) return
    const product = products.find((p) => p.id === productId)
    if (!product) {
      toast({
        variant: "destructive",
        title: t("workers.toastUpdateFailedTitle"),
        description: t("workers.productNotFound"),
      })
      return
    }
    if (product.workerId) {
      toast({
        variant: "destructive",
        title: t("workers.toastUpdateFailedTitle"),
        description: t("workers.productAlreadyAssigned"),
      })
      return
    }
    setAssigningProduct(true)
    try {
      await supabase
        .from("products")
        .update({ delivery_worker_id: selectedWorkerForProducts.id, status: "delivery" })
        .eq("id", productId)

      const updated = products.map((p) =>
        p.id === productId
          ? { ...p, workerId: String(selectedWorkerForProducts.id), status: normalizeStatus("delivery") }
          : p,
      )
      setStoreProducts(updated)
      setProductToAssign("")
      setProductIdInput("")
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("workers.toastUpdateFailedTitle"),
        description: err?.message || t("workers.toastUpdateFailedDesc"),
      })
    } finally {
      setAssigningProduct(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data, error }, { data: productsData }, { data: companiesData }] = await Promise.all([
        supabase
          .from("delivery_workers")
          .select("id, name, phone, profile_image_url, certificate_image_url, product_fee, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, client_name, phone, price, status, company_id, delivery_worker_id"),
        supabase.from("companies").select("id, name, combenef"),
      ])
      if (!error && data) {
        setWorkers(data)
        setStoreWorkers(
          data.map((w) => ({
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
        const nameById = new Map<string, string>()
        const benefitByName: Record<string, number> = {}
        companiesData?.forEach((c) => nameById.set(String(c.id), c.name))
        companiesData?.forEach((c) => {
          benefitByName[c.name] = Number(c.combenef || 0)
        })
        setCompanyBenefitByName(benefitByName)

        setStoreProducts(
          productsData.map((prod) => ({
            id: String(prod.id),
            clientName: prod.client_name,
            companyName: prod.company_id ? nameById.get(String(prod.company_id)) || String(prod.company_id) : "-",
            phone: prod.phone,
            price: Number(prod.price || 0),
            status: (prod.status as ProductStatus) || "in_stock",
            workerId: prod.delivery_worker_id ? String(prod.delivery_worker_id) : undefined,
          })),
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  const uploadFile = async (file: File, folder: string) => {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_WORKERS_BUCKET || "workers"
    if (!bucket) {
      throw new Error(t("workers.bucketMissing"))
    }
    const path = `${folder}/${crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    if (!data?.publicUrl) {
      throw new Error(t("workers.publicUrlMissing"))
    }
    return data.publicUrl
  }

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const [profileUrl, certificateUrl] = await Promise.all([
        profileFile ? uploadFile(profileFile, "profiles") : Promise.resolve(null),
        certificateFile ? uploadFile(certificateFile, "certificates") : Promise.resolve(null),
      ])

      const { data, error } = await supabase
        .from("delivery_workers")
        .insert({
          name: newWorker.name,
          phone: newWorker.phone,
          product_fee: newWorker.commission,
          profile_image_url: profileUrl || null,
          certificate_image_url: certificateUrl || null,
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setWorkers((prev) => [data, ...prev])
        setIsAddOpen(false)
        setNewWorker({ name: "", phone: "", commission: 0 })
        setProfileFile(null)
        setCertificateFile(null)
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("workers.toastUploadFailedTitle"),
        description: t("workers.toastUploadFailedDesc"),
      })
    }
  }

  const openEdit = (worker: any) => {
    setEditingWorker(worker)
    setEditProfileFile(null)
    setEditCertificateFile(null)
    setIsEditOpen(true)
  }

  const handleUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingWorker) return
    try {
      const [profileUrl, certificateUrl] = await Promise.all([
        editProfileFile ? uploadFile(editProfileFile, "profiles") : Promise.resolve(editingWorker.profile_image_url || null),
        editCertificateFile
          ? uploadFile(editCertificateFile, "certificates")
          : Promise.resolve(editingWorker.certificate_image_url || null),
      ])

      const { data, error } = await supabase
        .from("delivery_workers")
        .update({
          name: editingWorker.name,
          phone: editingWorker.phone,
          product_fee: editingWorker.product_fee,
          profile_image_url: profileUrl,
          certificate_image_url: certificateUrl,
        })
        .eq("id", editingWorker.id)
        .select()
        .single()

      if (error) throw error

      if (data) {
        setWorkers((prev) => prev.map((w) => (w.id === data.id ? data : w)))
        setIsEditOpen(false)
        setEditingWorker(null)
        setEditProfileFile(null)
        setEditCertificateFile(null)
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("workers.toastUpdateFailedTitle"),
        description: t("workers.toastUpdateFailedDesc"),
      })
    }
  }

  const handleDeleteWorker = async (id: number) => {
    const { error } = await supabase.from("delivery_workers").delete().eq("id", id)
    if (!error) {
      setWorkers((prev) => prev.filter((w) => w.id !== id))
    }
  }

  const handleArchiveCurrentAnalytics = (worker: any) => {
    const workerId = String(worker.id)
    const analytics = currentAnalyticsByWorker[workerId] || {
      deliveredCount: 0,
      totalRevenue: 0,
      workerBenefit: 0,
      netBenefit: 0,
    }

    if (analytics.deliveredCount === 0) {
      toast({
        variant: "destructive",
        title: t("workers.analyticsNoDataTitle"),
        description: t("workers.analyticsNoDataDesc"),
      })
      return
    }

    const signature = getAnalyticsSignature(analytics)
    const snapshot: WorkerAnalyticsArchive = {
      id: crypto.randomUUID(),
      workerId,
      workerName: worker.name,
      deliveredCount: analytics.deliveredCount,
      totalRevenue: analytics.totalRevenue,
      workerBenefit: analytics.workerBenefit,
      netBenefit: analytics.netBenefit,
      createdAt: new Date().toISOString(),
      signature,
    }

    setAnalyticsArchives((prev) => [snapshot, ...prev])
    setHiddenAnalyticsSignatures((prev) => ({ ...prev, [workerId]: signature }))

    toast({
      title: t("workers.analyticsArchivedTitle"),
      description: t("workers.analyticsArchivedDesc"),
    })
  }

  const handleDeleteArchive = (archiveId: string) => {
    const archive = analyticsArchives.find((item) => item.id === archiveId)
    if (!archive) return

    setAnalyticsArchives((prev) => prev.filter((item) => item.id !== archiveId))

    if (hiddenAnalyticsSignatures[archive.workerId] === archive.signature) {
      setHiddenAnalyticsSignatures((prev) => {
        const next = { ...prev }
        delete next[archive.workerId]
        return next
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("workers.title")}</h1>
            <p className="text-muted-foreground">{t("workers.subtitle")}</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> {t("workers.add")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("workers.dialogTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddWorker} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("workers.name")}</Label>
                  <Input
                    id="name"
                    required
                    value={newWorker.name}
                    onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">{t("workers.phone")}</Label>
                  <Input
                    id="phone"
                    required
                    value={newWorker.phone}
                    onChange={(e) => setNewWorker({ ...newWorker, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commission">{t("workers.commission")}</Label>
                  <Input
                    id="commission"
                    type="number"
                    step="0.01"
                    required
                    value={newWorker.commission}
                    onChange={(e) => setNewWorker({ ...newWorker, commission: Number.parseFloat(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                    <Plus className="h-4 w-4 mb-1" />
                    {profileFile ? profileFile.name : t("workers.profilePic")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setProfileFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                    <FileCheck className="h-4 w-4 mb-1" />
                    {certificateFile ? certificateFile.name : t("workers.certificates")}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <Button type="submit" className="w-full mt-4">
                  {t("workers.submit")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <Card key={worker.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-linear-to-r from-rehab-gradient-start to-rehab-gradient-end h-20" />
                <div className="px-6 pb-6 text-center">
                  <div className="-mt-10 mb-4 flex justify-center">
                    <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                      <AvatarImage src={worker.profile_image_url || "/placeholder.svg"} />
                      <AvatarFallback>{worker.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <h3 className="font-bold text-lg">{worker.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("workers.idLabel")}: {worker.id}
                  </p>

                  <div className="space-y-2 text-sm text-left">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-primary" />
                      <span>{worker.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3 text-primary" />
                      <span>
                        {worker.product_fee} {t("common.currency")} {t("workers.perDelivery")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-6">
                    <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={() => openEdit(worker)}>
                      {t("workers.edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDeleteWorker(worker.id)}
                    >
                      {t("workers.delete")}
                    </Button>
                  </div>

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        setSelectedWorkerForProducts(worker)
                        setIsProductsDialogOpen(true)
                      }}
                    >
                      <Package className="h-4 w-4" />
                      {t("workers.assignedProducts")} ({products.filter((p) => p.workerId === String(worker.id)).length})
                    </Button>
                  </div>

                  <div className="mt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        setSelectedWorkerForAnalytics(worker)
                        setIsAnalyticsDialogOpen(true)
                      }}
                    >
                      <ChartColumnBig className="h-4 w-4" />
                      {t("workers.analytics")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {workers.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
              {t("workers.empty")}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workers.editTitle")}</DialogTitle>
          </DialogHeader>
          {editingWorker && (
            <form onSubmit={handleUpdateWorker} className="space-y-4 pt-2">
              <div className="grid gap-2">
                <Label>{t("workers.name")}</Label>
                <Input
                  value={editingWorker.name}
                  onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("workers.phone")}</Label>
                <Input
                  value={editingWorker.phone}
                  onChange={(e) => setEditingWorker({ ...editingWorker, phone: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("workers.commission")}</Label>
                <Input
                  type="number"
                  value={editingWorker.product_fee}
                  onChange={(e) => setEditingWorker({ ...editingWorker, product_fee: Number.parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                  <Plus className="h-4 w-4 mb-1" />
                  {editProfileFile ? editProfileFile.name : t("workers.profilePic")}
                  {editingWorker.profile_image_url && !editProfileFile && (
                    <span className="text-[11px] text-muted-foreground mt-1">{t("workers.currentSet")}</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setEditProfileFile(e.target.files?.[0] || null)}
                  />
                </label>
                <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                  <FileCheck className="h-4 w-4 mb-1" />
                  {editCertificateFile ? editCertificateFile.name : t("workers.certificates")}
                  {editingWorker.certificate_image_url && !editCertificateFile && (
                    <a
                      className="text-[11px] text-primary underline mt-1"
                      href={editingWorker.certificate_image_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("workers.viewCurrent")}
                    </a>
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setEditCertificateFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <Button type="submit" className="w-full mt-2">
                {t("common.save")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Assigned Products Dialog */}
      <Dialog
        open={isProductsDialogOpen}
        onOpenChange={(open) => {
          setIsProductsDialogOpen(open)
          if (!open) {
            setProductToAssign("")
            setProductIdInput("")
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("workers.assignedProductsTitle", { name: selectedWorkerForProducts?.name || "" })}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
              <div className="grid gap-2 min-w-60">
                <Label>{t("workers.assignProduct")}</Label>
                <Select value={productToAssign} onValueChange={setProductToAssign}>
                  <SelectTrigger className="min-w-60">
                    <SelectValue placeholder={t("workers.assignSelect")} />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      .filter((p) => !p.workerId && normalizeStatus(p.status) === "in_stock")
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.id} — {p.clientName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 min-w-60">
                <Label htmlFor="assignById">{t("workers.assignById")}</Label>
                <Input
                  id="assignById"
                  value={productIdInput}
                  onChange={(e) => setProductIdInput(e.target.value)}
                  placeholder={t("workers.assignByIdPlaceholder")}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAssignProduct(productIdInput)
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                onClick={() => handleAssignProduct(productIdInput || productToAssign)}
                disabled={assigningProduct || !selectedWorkerForProducts || (!productToAssign && !productIdInput)}
              >
                {assigningProduct ? t("workers.assigning") : t("workers.assignConfirm")}
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stock.table.id")}</TableHead>
                    <TableHead>{t("stock.table.client")}</TableHead>
                    <TableHead>{t("stock.table.company")}</TableHead>
                    <TableHead>{t("stock.table.price")}</TableHead>
                    <TableHead>{t("stock.table.status")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedWorkerForProducts && products.filter((p) => p.workerId === String(selectedWorkerForProducts.id)).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell>{p.clientName}</TableCell>
                      <TableCell>{p.companyName}</TableCell>
                      <TableCell>{p.price} {t("common.currency")}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            normalizeStatus(p.status) === "delivered"
                              ? "secondary"
                              : normalizeStatus(p.status) === "canceled"
                                ? "destructive"
                                : "outline"
                          }
                          className="capitalize"
                        >
                          {statusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {normalizeStatus(p.status) === "delivered" ? (
                          <div className="flex justify-end gap-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              ✓ {t("stock.status.delivered")}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkStatus(p.id, "delivery")}
                            >
                              {t("workers.backToDelivery")}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMarkStatus(p.id, "delivered")}
                            >
                              {t("stock.status.delivered")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleMarkStatus(p.id, "canceled")}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {selectedWorkerForProducts && products.filter((p) => p.workerId === String(selectedWorkerForProducts.id)).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                        {t("workers.noAssignedProducts")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAnalyticsDialogOpen}
        onOpenChange={(open) => {
          setIsAnalyticsDialogOpen(open)
          if (!open) {
            setSelectedWorkerForAnalytics(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChartColumnBig className="h-5 w-5" />
              {t("workers.analyticsTitle", { name: selectedWorkerForAnalytics?.name || "" })}
            </DialogTitle>
          </DialogHeader>

          {selectedWorkerForAnalytics && (
            <Tabs defaultValue="current" className="mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="current">{t("workers.analyticsCurrentTab")}</TabsTrigger>
                <TabsTrigger value="archive">{t("workers.analyticsArchiveTab")}</TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="space-y-4 pt-4">
                {(() => {
                  const workerId = String(selectedWorkerForAnalytics.id)
                  const analytics = currentAnalyticsByWorker[workerId] || {
                    deliveredCount: 0,
                    totalRevenue: 0,
                    workerBenefit: 0,
                    netBenefit: 0,
                  }
                  const signature = getAnalyticsSignature(analytics)
                  const isArchived = hiddenAnalyticsSignatures[workerId] === signature

                  if (isArchived) {
                    return (
                      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        {t("workers.analyticsArchivedHidden")}
                      </div>
                    )
                  }

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{t("workers.analyticsDeliveredCount")}</p>
                            <p className="text-2xl font-bold">{analytics.deliveredCount}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{t("workers.analyticsRevenue")}</p>
                            <p className="text-2xl font-bold">{analytics.totalRevenue.toFixed(2)} {t("common.currency")}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{t("workers.analyticsWorkerBenefit")}</p>
                            <p className="text-2xl font-bold text-orange-600">-{analytics.workerBenefit.toFixed(2)} {t("common.currency")}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{t("workers.analyticsNetBenefit")}</p>
                            <p className="text-2xl font-bold text-green-600">{analytics.netBenefit.toFixed(2)} {t("common.currency")}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="flex justify-end">
                        <Button type="button" onClick={() => handleArchiveCurrentAnalytics(selectedWorkerForAnalytics)} className="gap-2">
                          <Archive className="h-4 w-4" />
                          {t("workers.analyticsArchiveAction")}
                        </Button>
                      </div>
                    </>
                  )
                })()}
              </TabsContent>

              <TabsContent value="archive" className="space-y-3 pt-4">
                {analyticsArchives
                  .filter((item) => item.workerId === String(selectedWorkerForAnalytics.id))
                  .map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                            <p>{t("workers.analyticsDeliveredCount")}: <strong>{item.deliveredCount}</strong></p>
                            <p>{t("workers.analyticsRevenue")}: <strong>{item.totalRevenue.toFixed(2)} {t("common.currency")}</strong></p>
                            <p>{t("workers.analyticsWorkerBenefit")}: <strong>-{item.workerBenefit.toFixed(2)} {t("common.currency")}</strong></p>
                            <p>{t("workers.analyticsNetBenefit")}: <strong>{item.netBenefit.toFixed(2)} {t("common.currency")}</strong></p>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDeleteArchive(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("workers.analyticsDeleteArchive")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                {analyticsArchives.filter((item) => item.workerId === String(selectedWorkerForAnalytics.id)).length === 0 && (
                  <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                    {t("workers.analyticsArchiveEmpty")}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
