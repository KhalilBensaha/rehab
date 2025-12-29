"use client"

import type React from "react"

import { useState } from "react"
import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Phone, DollarSign, FileCheck } from "lucide-react"

export default function WorkersPage() {
  const { workers, addWorker } = useStore()
  const [isAddOpen, setIsAddOpen] = useState(false)

  const [newWorker, setNewWorker] = useState({
    name: "",
    phone: "",
    commission: 0,
  })

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault()
    addWorker({
      ...newWorker,
      id: `W-${Math.floor(Math.random() * 1000)}`,
      profilePic: `/placeholder.svg?height=100&width=100&query=profile`,
      certificates: `/placeholder.svg?height=300&width=200&query=certificate`,
    })
    setIsAddOpen(false)
    setNewWorker({ name: "", phone: "", commission: 0 })
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
                  <Label htmlFor="commission">Commission per Delivery ($)</Label>
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
                  <div className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                    <Plus className="h-4 w-4 mb-1" />
                    Profile Pic
                  </div>
                  <div className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                    <FileCheck className="h-4 w-4 mb-1" />
                    Certificates
                  </div>
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
                      <AvatarImage src={worker.profilePic || "/placeholder.svg"} />
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
                      <span>${worker.commission} / delivery</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-6">
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      Edit Profile
                    </Button>
                    <Button variant="secondary" size="sm" className="w-full">
                      View Certificates
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
    </DashboardLayout>
  )
}
