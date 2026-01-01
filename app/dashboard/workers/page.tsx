"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Phone, DollarSign, FileCheck } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function WorkersPage() {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [workers, setWorkers] = useState<Array<any>>([])
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("delivery_workers")
        .select("id, name, phone, profile_image_url, certificate_image_url, product_fee, created_at")
        .order("created_at", { ascending: false })
      if (!error && data) {
        setWorkers(data)
      }
      setLoading(false)
    }
    load()
  }, [])

  const uploadFile = async (file: File, folder: string) => {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_WORKERS_BUCKET || "workers"
    if (!bucket) {
      throw new Error("Storage bucket name missing (set NEXT_PUBLIC_SUPABASE_WORKERS_BUCKET or create 'workers')")
    }
    const path = `${folder}/${crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    })
    if (uploadError) throw uploadError
    const { data, error: urlError } = supabase.storage.from(bucket).getPublicUrl(path)
    if (urlError) throw urlError
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
        title: "Upload failed",
        description: err?.message || err?.error || "Could not save worker. Check storage permissions and bucket name.",
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
        title: "Update failed",
        description: err?.message || err?.error || "Could not update worker.",
      })
    }
  }

  const handleDeleteWorker = async (id: number) => {
    const { error } = await supabase.from("delivery_workers").delete().eq("id", id)
    if (!error) {
      setWorkers((prev) => prev.filter((w) => w.id !== id))
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Delivery Workers</h1>
            <p className="text-muted-foreground">Manage your delivery team and their commissions.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Worker
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Delivery Worker</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddWorker} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    required
                    value={newWorker.name}
                    onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    required
                    value={newWorker.phone}
                    onChange={(e) => setNewWorker({ ...newWorker, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commission">Commission per Delivery (DZD)</Label>
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
                    {profileFile ? profileFile.name : "Profile Pic"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setProfileFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                    <FileCheck className="h-4 w-4 mb-1" />
                    {certificateFile ? certificateFile.name : "Certificates"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <Button type="submit" className="w-full mt-4">
                  Register Worker
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <Card key={worker.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-rehab-gradient-start to-rehab-gradient-end h-20" />
                <div className="px-6 pb-6 text-center">
                  <div className="-mt-10 mb-4 flex justify-center">
                    <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                      <AvatarImage src={worker.profile_image_url || "/placeholder.svg"} />
                      <AvatarFallback>{worker.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <h3 className="font-bold text-lg">{worker.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">ID: {worker.id}</p>

                  <div className="space-y-2 text-sm text-left">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-primary" />
                      <span>{worker.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3 text-primary" />
                      <span>{worker.product_fee} DZD / delivery</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-6">
                    <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={() => openEdit(worker)}>
                      Edit Profile
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDeleteWorker(worker.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {workers.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
              No workers registered yet.
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Worker Profile</DialogTitle>
          </DialogHeader>
          {editingWorker && (
            <form onSubmit={handleUpdateWorker} className="space-y-4 pt-2">
              <div className="grid gap-2">
                <Label>Full Name</Label>
                <Input
                  value={editingWorker.name}
                  onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Phone Number</Label>
                <Input
                  value={editingWorker.phone}
                  onChange={(e) => setEditingWorker({ ...editingWorker, phone: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Commission per Delivery (DZD)</Label>
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
                  {editProfileFile ? editProfileFile.name : "Profile Pic"}
                  {editingWorker.profile_image_url && !editProfileFile && (
                    <span className="text-[11px] text-muted-foreground mt-1">Current: set</span>
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
                  {editCertificateFile ? editCertificateFile.name : "Certificate"}
                  {editingWorker.certificate_image_url && !editCertificateFile && (
                    <a
                      className="text-[11px] text-primary underline mt-1"
                      href={editingWorker.certificate_image_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View current
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
                Save Changes
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
