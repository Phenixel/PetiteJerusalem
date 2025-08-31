import HomeView from '../views/HomeView.vue'
import ShareHomePage from '../views/ShareReading/ShareHomePage.vue'
import NewSession from '../views/ShareReading/NewSession.vue'
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
    path: '/share-reading/new-session',
    name: 'new-session',
    component: NewSession,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFound,
  },
]
