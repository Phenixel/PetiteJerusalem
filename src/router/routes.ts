import HomeView from '../views/HomeView.vue'
import LoginView from '../views/loginView.vue'
import ProfilePage from '../views/ProfilePage.vue'
import SessionManagementPage from '../views/SessionManagementPage.vue'
import ShareHomePage from '../views/ShareReading/ShareHomePage.vue'
import NewSession from '../views/ShareReading/NewSession.vue'
import DetailSession from '../views/ShareReading/DetailSession.vue'
import NotFound from '../views/NotFound.vue'

export default [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
  },
  {
    path: '/session-management/:id',
    name: 'session-management',
    component: SessionManagementPage,
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
    path: '/share-reading/session/:id',
    name: 'detail-session',
    component: DetailSession,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFound,
  },
]
