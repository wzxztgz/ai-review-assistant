import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Analyzing from '../views/Analyzing.vue'
import Report from '../views/Report.vue'
import ExamList from '../views/ExamList.vue'
import ExamDetail from '../views/ExamDetail.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/analyzing',
    name: 'Analyzing',
    component: Analyzing,
  },
  {
    path: '/report/:id?',
    name: 'Report',
    component: Report,
  },
  {
    path: '/exam',
    name: 'ExamList',
    component: ExamList,
  },
  {
    path: '/exam/:id',
    name: 'ExamDetail',
    component: ExamDetail,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
