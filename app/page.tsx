"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UserRole } from "@/lib/types"

const roles: Array<{ id: UserRole; label: string }> = [
  { id: "admin", label: "Administrador" },
  { id: "empresa", label: "Empresa" },
  { id: "candidato", label: "Candidato" },
]

export default function LandingPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const router = useRouter()
  const { login, isLoading } = useAuth()

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage("")

    try {
      await login({
        role: selectedRole,
        email: email.trim(),
        password,
      })

      router.push(`/${selectedRole}`)
    } catch (loginError) {
      setErrorMessage(
        loginError instanceof Error
          ? loginError.message
          : "Nao foi possivel autenticar. Tente novamente."
      )
    }
  }

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10">
      <Card className="w-full max-w-md border-zinc-200 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-semibold tracking-tight text-zinc-900">Perfiliza</CardTitle>
          <CardDescription className="text-zinc-600">Acesso ao sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            {errorMessage ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <select
                id="role"
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-offset-background focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                value={selectedRole}
                onChange={(event) => handleRoleChange(event.target.value as UserRole)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
