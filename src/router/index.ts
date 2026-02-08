import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/AppLayout.vue'
import LoginView from '@/views/LoginView.vue'
import ManagerOrders from '@/views/manager/ManagerOrders.vue'
import ManagerCustomers from '@/views/manager/ManagerCustomers.vue'
import PrintshopQueue from '@/views/printshop/PrintshopQueue.vue'
import DriverDeliveries from '@/views/driver/DriverDeliveries.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      redirect: () => {
        // This will be handled by the navigation guard
        return '/login'
      },
    },
    {
      path: '/manager',
      component: AppLayout,
      meta: { requiresAuth: true, role: 'manager' },
      children: [
        {
          path: 'orders',
          name: 'manager-orders',
          component: ManagerOrders,
        },
        {
          path: 'customers',
          name: 'manager-customers',
          component: ManagerCustomers,
        },
      ],
    },
    {
      path: '/printshop',
      component: AppLayout,
      meta: { requiresAuth: true, role: 'printshop_manager' },
      children: [
        {
          path: 'queue',
          name: 'printshop-queue',
          component: PrintshopQueue,
        },
      ],
    },
    {
      path: '/driver',
      component: AppLayout,
      meta: { requiresAuth: true, role: 'driver' },
      children: [
        {
          path: 'deliveries',
          name: 'driver-deliveries',
          component: DriverDeliveries,
        },
      ],
    },
  ],
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // Check if route requires authentication
  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) {
    // Redirect to login if not authenticated
    next('/login')
    return
  }

  // If authenticated and trying to access login, redirect to appropriate dashboard
  if (to.path === '/login' && authStore.isAuthenticated) {
    const role = authStore.userRole
    if (role === 'manager') {
      next('/manager/orders')
    } else if (role === 'printshop_manager') {
      next('/printshop/queue')
    } else if (role === 'driver') {
      next('/driver/deliveries')
    } else {
      next()
    }
    return
  }

  // Redirect root to role-appropriate dashboard
  if (to.path === '/' && authStore.isAuthenticated) {
    const role = authStore.userRole
    if (role === 'manager') {
      next('/manager/orders')
    } else if (role === 'printshop_manager') {
      next('/printshop/queue')
    } else if (role === 'driver') {
      next('/driver/deliveries')
    } else {
      next('/login')
    }
    return
  }

  // Check role-based access
  if (to.meta.role && authStore.userRole !== to.meta.role) {
    // User doesn't have the required role, redirect to their appropriate dashboard
    const role = authStore.userRole
    if (role === 'manager') {
      next('/manager/orders')
    } else if (role === 'printshop_manager') {
      next('/printshop/queue')
    } else if (role === 'driver') {
      next('/driver/deliveries')
    } else {
      next('/login')
    }
    return
  }

  next()
})

export default router
