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
import { Heart, Mail, Lock, AlertCircle, CheckCircle } from "lucide-react" // Added AlertCircle and CheckCircle
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null) // Added success state
  const router = useRouter() // Initialize useRouter
  const { setUser } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || `שגיאה בעת ההתחברות: ${response.statusText}`)
      } else {
        setSuccess(data.message || "התחברת בהצלחה! הנך מועבר/ת ללוח הבקרה.")
        setUser(data.user)
        // Store token in localStorage
        localStorage.setItem('token', data.token)
        // Clear form
        setEmail("")
        setPassword("")
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      }
    } catch (err) {
      console.error("Login fetch error:", err)
      setError("אירעה שגיאה בלתי צפויה. נסו שוב מאוחר יותר.")
    } finally {
      setIsLoading(false)
    }
  }

  // Placeholder for OAuth, not implemented in this scope
  const handleGoogleLogin = () => {
    console.log("Google login")
    setError("התחברות עם גוגל עדיין לא נתמכת.")
    // window.location.href = "/dashboard"
  }

  const handleFacebookLogin = () => {
    console.log("Facebook login")
    setError("התחברות עם פייסבוק עדיין לא נתמכת.")
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
          <CardTitle className="text-2xl">ברוכים השבים</CardTitle>
          <CardDescription>התחברו לחשבון החתונה שלכם</CardDescription>
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
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); setSuccess(null); }}
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
                  placeholder="הזינו את הסיסמה שלכם"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); setSuccess(null); }}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "מתחבר..." : "התחברות"}
            </Button>
          </form>

          <Separator />

          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading}>
              המשך עם Google
            </Button>
            <Button variant="outline" className="w-full" onClick={handleFacebookLogin} disabled={isLoading}>
              המשך עם Facebook
            </Button>
          </div>

          <div className="text-center text-sm">
            {"אין לכם חשבון? "}
            <Link href="/register" className="text-pink-500 hover:underline">
              הרשמה
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}