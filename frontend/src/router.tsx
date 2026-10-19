import { createBrowserRouter } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { RecipeEditorPage } from '@/pages/recipes/RecipeEditorPage'
import { RecipesPage } from '@/pages/recipes/RecipesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SuppliesPage } from '@/pages/supplies/SuppliesPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'suministros', element: <SuppliesPage /> },
      { path: 'recetas', element: <RecipesPage /> },
      { path: 'recetas/nueva', element: <RecipeEditorPage key="new" /> },
      { path: 'recetas/:id', element: <RecipeEditorPage /> },
      { path: 'productos', element: <ProductsPage /> },
      { path: 'ajustes', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
