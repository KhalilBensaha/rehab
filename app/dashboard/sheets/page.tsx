"use client"

import { Label } from "@/components/ui/label"
import { useState, Suspense } from "react"
import { useStore, type Worker } from "@/lib/store"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, UserCircle, ExternalLink, ArrowRightLeft } from "lucide-react"

function SheetsContent() {
  const { workers, products, assignProduct, detachProduct } = useStore()
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [productToAssign, setProductToAssign] = useState<string>("")

  const workerProducts = selectedWorker ? products.filter((p) => p.workerId === selectedWorker.id) : []

  const availableProducts = products.filter((p) => p.status === "in stock")

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Worker Sheets</h1>
          <p className="text-muted-foreground">View worker assignments and manage product distribution.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Workers List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" /> Delivery Team
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
                        {products.filter((p) => p.workerId === worker.id).length} assignments
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-50" />
                  </CardContent>
                </Card>
              ))}
              {workers.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-8">No workers found.</p>
              )}
            </div>
          </div>
          
          {/* Sheet Detail */}
          <div className="lg:col-span-2">
            {selectedWorker ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-xl">{selectedWorker.name}'s Sheet</CardTitle>
                    <p className="text-sm text-muted-foreground">Commission: ${selectedWorker.commission} / product</p>
                  </div>
                  <Button onClick={() => setIsAssignOpen(true)} className="gap-2">
                    <ArrowRightLeft className="h-4 w-4" /> Affect Product
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workerProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.id}</TableCell>
                          <TableCell>{p.clientName}</TableCell>
                          <TableCell>{p.companyName}</TableCell>
                          <TableCell>${p.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => detachProduct(p.id)}
                            >
                              Detach
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {workerProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            No products currently assigned to this worker.
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
                <p>Select a worker from the list to view their delivery sheet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Assign Modal */}
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Affect Product to {selectedWorker?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Product from Stock</Label>
                <Select onValueChange={setProductToAssign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Search available products..." />
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
              <Button
                className="w-full"
                disabled={!productToAssign}
                onClick={() => {
                  if (selectedWorker) {
                    assignProduct(productToAssign, selectedWorker.id)
                    setIsAssignOpen(false)
                    setProductToAssign("")
                  }
                }}
              >
                Confirm Assignment
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
