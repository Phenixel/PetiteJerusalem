import HomeView from '../views/HomeView.vue'
import ShareHomePage from '../views/ShareReading/ShareHomePage.vue'
import NotFound from '../views/NotFound.vue'

export default [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/share-reading',
    name: 'share-reading',
    component: ShareHomePage,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFound,
  },
]
