"use client"

import type React from "react"
import { useState, Suspense } from "react"
import { useStore, type ProductStatus } from "@/lib/store"
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
  const { products, companies, addProduct, updateProductStatus } = useStore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [filterCompany, setFilterCompany] = useState<string>("all")
  const [search, setSearch] = useState("")

  const [newProduct, setNewProduct] = useState({
    clientName: "",
    companyName: "",
    phone: "",
    price: 0,
  })

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault()
    const id = `PROD-${Math.floor(Math.random() * 10000)}`
    addProduct({
      ...newProduct,
      id,
      status: "in stock",
    })
    setIsAddOpen(false)
    setNewProduct({ clientName: "", companyName: "", phone: "", price: 0 })
  }

  const filteredProducts = products.filter((p) => {
    const matchesCompany = filterCompany === "all" || p.companyName === filterCompany
    const matchesSearch = p.clientName.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
    return matchesCompany && matchesSearch
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Stock Management</h1>
            <p className="text-muted-foreground">Manage and track your products inventory.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddProduct} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="client">Client Name</Label>
                  <Input
                    id="client"
                    required
                    value={newProduct.clientName}
                    onChange={(e) => setNewProduct({ ...newProduct, clientName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Company</Label>
                  <Select required onValueChange={(val) => setNewProduct({ ...newProduct, companyName: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      required
                      value={newProduct.phone}
                      onChange={(e) => setNewProduct({ ...newProduct, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      required
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: Number.parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-4">
                  Create Product
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4 items-center bg-card p-4 rounded-lg border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by client or ID..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
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
                <TableHead>ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.clientName}</div>
                      <div className="text-xs text-muted-foreground">{p.phone}</div>
                    </TableCell>
                    <TableCell>{p.companyName}</TableCell>
                    <TableCell>${p.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "delivered"
                            ? "secondary"
                            : p.status === "canceled"
                              ? "destructive"
                              : p.status === "delivery"
                                ? "outline"
                                : "default"
                        }
                        className="capitalize"
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select value={p.status} onValueChange={(val) => updateProductStatus(p.id, val as ProductStatus)}>
                        <SelectTrigger className="w-[130px] ml-auto h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in stock">In Stock</SelectItem>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="canceled">Canceled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No products found in stock.
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
