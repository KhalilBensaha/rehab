"use client"

import { useStore } from "./store"

export type Locale = "en" | "fr" | "ar"

export const translations = {
  en: {
    dir: "ltr",
    login: {
      title: "REHAB Login",
      description: "Enter your credentials to access the delivery management system",
      email: "Email",
      password: "Password",
      submit: "Sign In",
      welcome: "Welcome back!",
      failed: "Login failed",
      userNotFound: "User not found. Try super@rehab.com",
    },
    nav: {
      overview: "Overview",
      stock: "Stock / Supply",
      workers: "Delivery Workers",
      sheets: "Sheets",
      companies: "Companies",
      admins: "Admins",
      treasure: "Treasure",
      logout: "Logout",
      dashboard: "Dashboard",
    },
    adminManagement: "Admin Management",
    createAndManageAccessLevels: "Create and manage access levels for your team.",
    addAdmin: "Add Admin",
    inviteNewAdmin: "Invite New Admin",
    name: "Name",
    emailAddress: "Email Address",
    createAdminAccount: "Create Admin Account",
    user: "User",
    role: "Role",
    actions: "Actions",
    viewDetails: "View Details",
    toggleSuperStatus: "Toggle Super Status",
    userDetails: "User Details",
    fullName: "Full Name",
    userID: "User ID",
    dangerZone: "Danger Zone",
    removeUserAccess: "Remove User Access",
    cannotRemoveOwnAccess: "You cannot remove your own administrative access.",
  },
  fr: {
    dir: "ltr",
    login: {
      title: "Connexion REHAB",
      description: "Entrez vos identifiants pour accéder au système de gestion",
      email: "Email",
      password: "Mot de passe",
      submit: "Se connecter",
      welcome: "Bon retour !",
      failed: "Échec de la connexion",
      userNotFound: "Utilisateur non trouvé. Essayez super@rehab.com",
    },
    nav: {
      overview: "Aperçu",
      stock: "Stock / Appro",
      workers: "Livreurs",
      sheets: "Feuilles",
      companies: "Entreprises",
      admins: "Administrateurs",
      treasure: "Trésorerie",
      logout: "Déconnexion",
      dashboard: "Tableau de bord",
    },
    adminManagement: "Gestion des Administrateurs",
    createAndManageAccessLevels: "Créez et gérez les niveaux d'accès pour votre équipe.",
    addAdmin: "Ajouter Admin",
    inviteNewAdmin: "Inviter un nouvel Admin",
    name: "Nom",
    emailAddress: "Adresse Email",
    createAdminAccount: "Créer le compte Admin",
    user: "Utilisateur",
    role: "Rôle",
    actions: "Actions",
    viewDetails: "Voir les détails",
    toggleSuperStatus: "Changer le statut Super",
    userDetails: "Détails de l'utilisateur",
    fullName: "Nom complet",
    userID: "ID Utilisateur",
    dangerZone: "Zone de Danger",
    removeUserAccess: "Supprimer l'accès utilisateur",
    cannotRemoveOwnAccess: "Vous ne pouvez pas supprimer votre propre accès administratif.",
  },
  ar: {
    dir: "rtl",
    login: {
      title: "تسجيل الدخول REHAB",
      description: "أدخل بياناتك للوصول إلى نظام إدارة التوصيل",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      submit: "تسجيل الدخول",
      welcome: "مرحباً بعودتك!",
      failed: "فشل تسجيل الدخول",
      userNotFound: "المستخدم غير موجود. جرب super@rehab.com",
    },
    nav: {
      overview: "نظرة عامة",
      stock: "المخزون / التوريد",
      workers: "عمال التوصيل",
      sheets: "الكشوفات",
      companies: "الشركات",
      admins: "المشرفين",
      treasure: "الخزينة",
      logout: "تسجيل الخروج",
      dashboard: "لوحة التحكم",
    },
    adminManagement: "إدارة المشرفين",
    createAndManageAccessLevels: "إنشاء وإدارة مستويات الوصول لفريقك.",
    addAdmin: "إضافة مشرف",
    inviteNewAdmin: "دعوة مشرف جديد",
    name: "الاسم",
    emailAddress: "البريد الإلكتروني",
    createAdminAccount: "إنشاء حساب مشرف",
    user: "المستخدم",
    role: "الدور",
    actions: "الإجراءات",
    viewDetails: "عرض التفاصيل",
    toggleSuperStatus: "تبديل حالة المشرف المتميز",
    userDetails: "تفاصيل المستخدم",
    fullName: "الاسم الكامل",
    userID: "معرف المستخدم",
    dangerZone: "منطقة الخطر",
    removeUserAccess: "إزالة وصول المستخدم",
    cannotRemoveOwnAccess: "لا يمكنك إزالة وصولك الإداري الخاص بك.",
  },
}

export function useTranslations() {
  const { locale } = useStore()

  const t = (path: string) => {
    const keys = path.split(".")
    let current: any = translations[locale]

    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key]
      } else {
        // Fallback to translation key name if not found
        return path
      }
    }

    return current
  }

  return { t, locale, dir: translations[locale].dir }
}
