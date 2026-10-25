import { createBrowserRouter } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { RouteError } from '@/components/layout/RouteError'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { MenuPage } from '@/pages/menu/MenuPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductEditorPage } from '@/pages/products/ProductEditorPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { RecipeEditorPage } from '@/pages/recipes/RecipeEditorPage'
import { RecipesPage } from '@/pages/recipes/RecipesPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { KitchenSheetPage } from '@/pages/sheets/KitchenSheetPage'
import { ProductSheetPage } from '@/pages/sheets/ProductSheetPage'
import { RecipeSheetPage } from '@/pages/sheets/RecipeSheetPage'
import { SimulatorPage } from '@/pages/simulator/SimulatorPage'
import { SuppliesPage } from '@/pages/supplies/SuppliesPage'

export const router = createBrowserRouter([
  // Printable sheets (cost and kitchen): no sidebar or top bar.
  { path: 'recetas/:id/ficha', element: <RecipeSheetPage />, errorElement: <RouteError /> },
  { path: 'recetas/:id/cocina', element: <KitchenSheetPage />, errorElement: <RouteError /> },
  { path: 'productos/:id/ficha', element: <ProductSheetPage />, errorElement: <RouteError /> },
  {
    element: <AppLayout />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'suministros', element: <SuppliesPage /> },
          { path: 'recetas', element: <RecipesPage /> },
          { path: 'recetas/nueva', element: <RecipeEditorPage key="new" /> },
          { path: 'recetas/:id', element: <RecipeEditorPage /> },
          { path: 'productos', element: <ProductsPage /> },
          { path: 'productos/nuevo', element: <ProductEditorPage key="new" /> },
          { path: 'productos/:id', element: <ProductEditorPage /> },
          { path: 'menu', element: <MenuPage /> },
          { path: 'ajustes', element: <SettingsPage /> },
          { path: 'simulador', element: <SimulatorPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
