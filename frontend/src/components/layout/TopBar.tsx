import { Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { findNavItem, NEW_PARAM, SEARCH_PARAM } from '@/navigation'

export function TopBar() {
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const current = findNavItem(pathname)
  // Detail/editor routes (e.g. /recetas/12) get the title but not the list's search box.
  const isListPage = current?.path === pathname
  const urlSearch = searchParams.get(SEARCH_PARAM) ?? ''
  // Typed text lives locally and reaches the URL debounced, so fast typing never drops characters.
  const [search, setSearch] = useState(urlSearch)
  const lastPushed = useRef(urlSearch)

  useEffect(() => {
    // URL changed from outside (navigation, back button): reflect it in the input.
    if (urlSearch !== lastPushed.current) {
      lastPushed.current = urlSearch
      setSearch(urlSearch)
    }
  }, [urlSearch])

  useEffect(() => {
    if (search === lastPushed.current) return
    const timer = setTimeout(() => {
      lastPushed.current = search
      setSearchParams(
        (params) => {
          if (search) params.set(SEARCH_PARAM, search)
          else params.delete(SEARCH_PARAM)
          return params
        },
        { replace: true },
      )
    }, 200)
    return () => clearTimeout(timer)
  }, [search, setSearchParams])

  function openNew() {
    if (current?.newPath) {
      navigate(current.newPath)
      return
    }
    setSearchParams(
      (params) => {
        params.set(NEW_PARAM, '1')
        return params
      },
      { replace: true },
    )
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-surface-card px-6">
      <h1 className="text-base font-semibold">{current?.label ?? 'Página no encontrada'}</h1>

      {isListPage && current?.searchPlaceholder && (
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={current.searchPlaceholder}
            className="h-8 pl-8"
            aria-label="Buscar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}

      {isListPage && current?.newLabel && (
        <Button
          size="sm"
          className={current.searchPlaceholder ? undefined : 'ml-auto'}
          onClick={openNew}
        >
          <Plus />
          {current.newLabel}
        </Button>
      )}
    </header>
  )
}
