import { Application } from '@nativescript/core'
import { createApp } from 'nativescript-vue'

import AppShell from './components/AppShell.vue'
import { pdvStore } from './services/PdvStoreDirectus'

// Inicializa o PDV Store com dados do Directus
Application.on(Application.launchEvent, async () => {
  console.log('App: Inicializando PDV Store...')
  try {
    await pdvStore.initialize()
    console.log('App: PDV Store inicializado com sucesso')
  }
  catch (error) {
    console.error('App: Erro ao inicializar PDV Store', error)
  }
})

createApp(AppShell).start()
