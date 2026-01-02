"use client"

import { useTheme } from "next-themes"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useTranslations } from "@/lib/i18n"
import { useStore } from "@/lib/store"

export default function SettingsPage() {
  const { t } = useTranslations()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale, setCurrentUser } = useStore()

  const handleLogout = () => {
    setCurrentUser(null)
    // redirect handled by layout guard
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{t("settingsPage.title")}</h1>
            <p className="text-muted-foreground">{t("settingsPage.subtitle")}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("settingsPage.theme")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={(theme as string) || "light"} onValueChange={(val) => setTheme(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("settingsPage.themeLight")}</SelectItem>
                  <SelectItem value="dark">{t("settingsPage.themeDark")}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settingsPage.language")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={locale || "en"} onValueChange={(val) => setLocale(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{t("settingsPage.danger")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <Button variant="destructive" onClick={handleLogout} className="w-fit">
              {t("settingsPage.logout")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
