"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from 'next/navigation' // Import useRouter
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Heart, Mail, Lock, User, AlertCircle, CheckCircle } from "lucide-react" // Added AlertCircle and CheckCircle

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
    userType: "bride/groom" as "bride/groom",
    weddingDate: "",
    weddingTime: "",
    weddingVenue: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter() // Initialize useRouter

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
    // Clear errors/success messages when user starts typing again
    setError(null)
    setSuccess(null)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (formData.password !== formData.confirmPassword) {
      setError("הסיסמאות אינן תואמות!")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phoneNumber: formData.phoneNumber,
          userType: formData.userType,
          weddingDate: formData.weddingDate,
          weddingTime: formData.weddingTime,
          weddingVenue: formData.weddingVenue,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || `שגיאה בעת ההרשמה: ${response.statusText}`)
      } else {
        setSuccess(data.message || "ההרשמה בוצעה בהצלחה! הנך מועבר/ת ללוח הבקרה.")
        // Clear form
        setFormData({
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
          phoneNumber: "",
          userType: "bride/groom",
          weddingDate: "",
          weddingTime: "",
          weddingVenue: ""
        });
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      }
    } catch (err) {
      console.error("Register fetch error:", err)
      setError("אירעה שגיאה בלתי צפויה. נסו שוב מאוחר יותר.")
    } finally {
      setIsLoading(false)
    }
  }

  // Placeholder for OAuth, not implemented in this scope
  const handleGoogleSignup = () => {
    console.log("Google signup")
    setError("הרשמה עם גוגל עדיין לא נתמכת.")
    // window.location.href = "/dashboard"
  }

  const handleFacebookSignup = () => {
    console.log("Facebook signup")
    setError("הרשמה עם פייסבוק עדיין לא נתמכת.")
    // window.location.href = "/dashboard"
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Heart className="h-12 w-12 text-pink-500" />
          </div>
          <CardTitle className="text-2xl">צרו את החשבון שלכם</CardTitle>
          <CardDescription>התחילו לתכנן את החתונה המושלמת שלכם</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center p-3 text-sm text-red-700 bg-red-100 rounded-md border border-red-200">
              <AlertCircle className="w-5 h-5 ml-2" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center p-3 text-sm text-green-700 bg-green-100 rounded-md border border-green-200">
              <CheckCircle className="w-5 h-5 ml-2" />
              {success}
            </div>
          )}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם מלא</Label>
              <div className="relative">
                <User className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="השם המלא שלכם"
                  value={formData.name}
                  onChange={handleChange}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">מספר טלפון</Label>
              <div className="relative">
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="הזינו מספר טלפון"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weddingDate">תאריך החתונה</Label>
              <div className="relative">
                <Input
                  id="weddingDate"
                  type="date"
                  value={formData.weddingDate}
                  onChange={handleChange}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weddingTime">שעת החתונה</Label>
              <div className="relative">
                <Input
                  id="weddingTime"
                  type="time"
                  value={formData.weddingTime}
                  onChange={handleChange}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weddingVenue">מיקום החתונה</Label>
              <div className="relative">
                <Input
                  id="weddingVenue"
                  type="text"
                  placeholder="הזינו את מיקום החתונה"
                  value={formData.weddingVenue}
                  onChange={handleChange}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="צרו סיסמה (לפחות 6 תווים)"
                  value={formData.password}
                  onChange={handleChange}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אישור סיסמה</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="אשרו את הסיסמה שלכם"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "יוצר חשבון..." : "צרו חשבון"}
            </Button>
          </form>

          <Separator />

          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={handleGoogleSignup} disabled={isLoading}>
              הרשמה עם Google
            </Button>
            <Button variant="outline" className="w-full" onClick={handleFacebookSignup} disabled={isLoading}>
              הרשמה עם Facebook
            </Button>
          </div>

          <div className="text-center text-sm">
            {"כבר יש לכם חשבון? "}
            <Link href="/login" className="text-pink-500 hover:underline">
              התחברות
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
