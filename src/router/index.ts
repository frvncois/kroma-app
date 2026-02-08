import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import ManagerOrders from '@/views/manager/ManagerOrders.vue'
import ManagerCustomers from '@/views/manager/ManagerCustomers.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/manager/orders',
    },
    {
      path: '/manager',
      component: AppLayout,
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
  ],
})

export default router
