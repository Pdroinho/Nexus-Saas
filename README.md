=== Nexus SaaS Platform ===
Contributors: Dev
Tags: lms, saas, members area, react, spa, core-dev-kit
Requires at least: 6.2
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 2.4.0
License: GPLv2 or later

Uma plataforma de área de membros "Managed SaaS" ultra-moderna, SPA (Single Page Application), com Studio de criação integrado.

== Descrição ==

O Nexus SaaS transforma seu WordPress em uma experiência de aplicativo nativo (estilo Netflix/Spotify) para ensino e comunidades. Diferente de plugins LMS tradicionais, ele foca em uma experiência fluida, sem "cara de WordPress", e possui ferramentas poderosas de gestão de conteúdo e vendas (Upsell) embutidas diretamente no front-end.

**Recursos Principais:**

* 🚀 **Navegação SPA Instantânea:** Transições de tela sem recarregamento (State-Based Routing).
* 🎨 **Design System "Nexus":** Interface profissional com suporte nativo a Dark Mode/Light Mode e componentes animados.
* 🛠️ **Studio Pro (CMS Headless):** Crie cursos, módulos e aulas arrastando e soltando, sem nunca acessar o painel wp-admin.
* 📺 **Player Polimórfico:** Suporte nativo para Vídeo, PDF (Leitura), Código (Syntax Highlight) e Lives.
* 💰 **Ecossistema de Vendas:** Gestão de acesso (Grátis/Pago) com links de checkout e ofertas integradas.

== Requisitos ==

Este plugin é uma "Skin/App" que roda sobre um motor gráfico.
* **Obrigatório:** Plugin `Core Dev Kit` (Engine v5.0+) instalado e ativo.

== Instalação ==

1.  Certifique-se de que o **Core Dev Kit** está instalado.
2.  Faça o upload da pasta `nexus-saas` para o diretório `/wp-content/plugins/` do seu WordPress.
3.  Ative o plugin através do menu 'Plugins' no WordPress.
4.  Crie uma nova página (ex: "App" ou "Membros").
5.  Adicione o shortcode `[saas_area]` no conteúdo da página.
6.  **Importante:** Configure o layout da página para "Canvas", "Blank" ou "Sem Cabeçalho/Rodapé" nas configurações do seu tema para garantir a experiência imersiva em tela cheia.

== Arquitetura (Para Desenvolvedores) ==

Este projeto utiliza a arquitetura monolítica "No-Build" para máxima portabilidade e velocidade de iteração.

* `saas-platform.php`: Contém toda a lógica de Backend (CPTs, Taxonomias, Campos Personalizados e Endpoints da REST API).
* `app.js`: Contém toda a lógica de Frontend (React Components, Gerenciamento de Estado, Roteamento e Estilos Tailwind via JS).

Não há passos de compilação (npm/webpack). O código é interpretado diretamente pelo navegador via Core Dev Kit.

====================================================================
🧠 MANUAL DE DESENVOLVIMENTO (CORE DEV KIT / INSTRUÇÕES DA IA)
====================================================================
As instruções abaixo regem o desenvolvimento e manutenção deste plugin.
Qualquer alteração deve respeitar estritamente estas regras.

# MANUAL DE DESENVOLVIMENTO: CORE DEV KIT (ENGINE) v5.0

ESTE AMBIENTE WORDPRESS POSSUI UM "MOTOR" JÁ CARREGADO (REACT + TAILWIND + LUCIDE + ROUTER).
AO CRIAR OU EDITAR ESTE PLUGIN, SIGA ESTRITAMENTE AS REGRAS ABAIXO:

---

## 1. REGRAS DE OURO (O QUE NÃO FAZER)
[X] NÃO use `npm`, `webpack`, `vite` ou build steps.
[X] NÃO use `import` ou `require` (o navegador não suporta nativamente neste contexto).
[X] NÃO baixe bibliotecas externas. Use as globais fornecidas pelo Motor.
[X] NÃO crie subpastas complexas. Mantenha `app.js` na raiz do plugin filho.

---

## 2. RECURSOS DISPONÍVEIS (GLOBAIS)
O plugin "Core Dev Kit" injeta estas variáveis no `window`. Use-as diretamente:

- React:       `window.React` (ex: `const { useState } = window.React;`)
- ReactDOM:    `window.ReactDOM`
- Router:      `window.ReactRouterDOM` (HashRouter, Route, Link...)
- Tailwind:    JÁ ATIVO. Use `className="..."`.
  - Modo Escuro: Ativo via classe 'dark'. Use `dark:bg-gray-800`.
- Utilitários: `window.CoreKit`
  - Toast: `CoreKit.Toast({ message: 'Oi', type: 'success' })`
  - Icon:  `<CoreKit.Icon name="Activity" />` (Ícones Lucide)

---

## 3. ESTRUTURA PADRÃO (Backend - PHP)
No arquivo PHP principal do seu plugin (`saas-platform.php`), use este padrão para carregar o App:

```php
add_shortcode('meu_app', function() {
    // 1. Verifica se o Motor está ativo
    if (!wp_script_is('dk-engine-master', 'registered')) {
        return 'ERRO: Core Dev Kit necessário.';
    }

    // 2. Carrega seu JS (dependendo do Motor)
    wp_enqueue_script('meu-app-js', plugin_dir_url(__FILE__) . 'app.js', ['dk-engine-master'], time(), true);
    
    // 3. Passa configurações para o JS (Nonces, URLs, User Data)
    wp_localize_script('meu-app-js', 'AppConfig', [
        'root' => 'app-root-' . uniqid(),
        'apiNonce' => wp_create_nonce('wp_rest'),
        'apiBase' => get_rest_url(null, 'nexus/v1'),
        'user' => [ ... ]
    ]);
    
    return '<div id="app-root"></div>'; // O ID deve bater com o Config
});
