<?php
/**
 * Plugin Name: SaaS Platform (Member Area)
 * Description: Área de membros moderna baseada no Core Dev Kit Engine.
 * Version: 1.3.0
 * Author: Dev
 * Requires Plugins: core-dev-kit
 */

if (!defined('ABSPATH')) exit;

// --- 1. CONFIGURAÇÃO E CARREGAMENTO DO FRONTEND ---

add_shortcode('saas_area', function() {
    if (!wp_script_is('dk-engine-master', 'registered')) {
        return '<div style="color:red; padding:20px;">ERRO: Plugin "Core Dev Kit" é obrigatório.</div>';
    }

        $ver = file_exists(plugin_dir_path(__FILE__) . 'app.js') ? filemtime(plugin_dir_path(__FILE__) . 'app.js') : time();
wp_enqueue_script(
        'saas-platform-app', 
        plugin_dir_url(__FILE__) . 'app.js', 
        ['dk-engine-master'], 
        $ver, 
        true
    );
    
    $rootId = 'saas-root-' . uniqid();
    wp_localize_script('saas-platform-app', 'SaasConfig', [
        'root' => $rootId,
        'apiNonce' => wp_create_nonce('wp_rest'),
        'apiBase' => get_rest_url(null, 'nexus/v1'),
        'user' => [
            'name' => wp_get_current_user()->display_name,
            'avatar' => get_avatar_url(get_current_user_id()),
            'roles' => wp_get_current_user()->roles,
            'can_edit_posts' => current_user_can('edit_posts'),
            'can_manage_upsell' => current_user_can('manage_options'),
        ]
    ]);
   
    return '<div id="' . esc_attr($rootId) . '" class="saas-wrapper"></div>';
});

// --- 2. ESTRUTURA DE DADOS (CPTS) ---

add_action('init', function() {
    register_post_type('nexus_course', [
        'labels' => ['name' => 'Cursos', 'singular_name' => 'Curso'],
        'public' => true,
        'show_in_rest' => true,
        'supports' => ['title', 'editor', 'thumbnail', 'excerpt'],
        'menu_icon' => 'dashicons-welcome-learn-more',
        'has_archive' => false
    ]);

    register_post_type('nexus_lesson', [
        'labels' => ['name' => 'Aulas', 'singular_name' => 'Aula'],
        'public' => true,
        'show_in_rest' => true,
        'supports' => ['title', 'editor', 'thumbnail'], 
        'menu_icon' => 'dashicons-playlist-video',
        'hierarchical' => false
    ]);

    register_taxonomy('nexus_module', ['nexus_lesson'], [
        'labels' => ['name' => 'Módulos', 'singular_name' => 'Módulo'],
        'public' => true,
        'show_in_rest' => true,
        'hierarchical' => true,
    ]);

    // Meta do termo (vincula módulo ao curso) para evitar mistura entre cursos
    register_term_meta('nexus_module', '_nexus_course_id', [
        'type' => 'integer',
        'single' => true,
        'show_in_rest' => true,
        'sanitize_callback' => 'absint',
        'auth_callback' => function() { return current_user_can('edit_posts'); }
    ]);
});

// --- 3. CAMPOS PERSONALIZADOS (REST) ---

add_action('rest_api_init', function() {
    register_rest_field('nexus_lesson', 'content_data', [
        'get_callback' => function($post) {
            return [
                'video_url' => get_post_meta($post['id'], '_nexus_video_url', true),
                'duration' => get_post_meta($post['id'], '_nexus_duration', true),
                'pdf_url' => get_post_meta($post['id'], '_nexus_pdf_url', true),
            ];
        },
        'update_callback' => function($value, $post) {
            if (is_array($value)) {
                foreach ($value as $k => $v) update_post_meta($post->ID, '_nexus_' . $k, $v);
            }
            return true;
        }
    ]);
});

// --- 4. ENDPOINTS API CUSTOMIZADOS ---

add_action('rest_api_init', function() {
    
    // GET: Estrutura do Curso + Progresso
    register_rest_route('nexus/v1', '/course/(?P<id>\d+)', [
        'methods' => 'GET',
        'callback' => function($data) {
            $course_id = $data['id'];
            $user_id = get_current_user_id();
            
            // Recupera e higieniza o array de progresso
            $raw_completed = get_user_meta($user_id, '_nexus_completed_lessons', true);
            $completed_lessons = [];
            if (is_array($raw_completed)) {
                $completed_lessons = array_map('intval', $raw_completed);
            }
            
            $lessons = get_posts([
                'post_type' => 'nexus_lesson',
                'numberposts' => -1,
                'meta_key' => '_nexus_course_id',
                'meta_value' => $course_id,
                'orderby' => 'menu_order', 
                'order' => 'ASC'
            ]);

            $structure = [];
            foreach ($lessons as $lesson) {
                $terms = get_the_terms($lesson->ID, 'nexus_module');
                $module_name = ($terms && !is_wp_error($terms)) ? $terms[0]->name : 'Geral';
                $module_id = ($terms && !is_wp_error($terms)) ? $terms[0]->term_id : 0;

                if (!isset($structure[$module_id])) {
                    $structure[$module_id] = [
                        'title' => $module_name,
                        'lessons' => []
                    ];
                }

                $type = get_post_meta($lesson->ID, '_nexus_type', true) ?: 'video';
                
                $structure[$module_id]['lessons'][] = [
                    'id' => $lesson->ID,
                    'title' => $lesson->post_title,
                    'type' => $type,
                    'duration' => get_post_meta($lesson->ID, '_nexus_duration', true) ?: '10 min',
                    'is_completed' => in_array((int)$lesson->ID, $completed_lessons, true),
                    'content' => [
                        'video_url' => get_post_meta($lesson->ID, '_nexus_video_url', true),
                        'pdf_url' => get_post_meta($lesson->ID, '_nexus_pdf_url', true),
                        'html' => apply_filters('the_content', $lesson->post_content)
                    ]
                ];
            }

            return new WP_REST_Response(array_values($structure), 200);
        },
        'permission_callback' => function() { return is_user_logged_in(); }
    ]);

    // POST: Marcar/Desmarcar como Concluído
    register_rest_route('nexus/v1', '/lesson/(?P<id>\d+)/complete', [
        'methods' => 'POST',
        'callback' => function($data) {
            $lesson_id = (int) $data['id'];
            $user_id = get_current_user_id();
            
            // Busca dados atuais
            $raw_completed = get_user_meta($user_id, '_nexus_completed_lessons', true);
            $completed = is_array($raw_completed) ? array_map('intval', $raw_completed) : [];
            
            $status = false;
            
            // Verifica se já existe
            if (in_array($lesson_id, $completed, true)) {
                // Remove
                $completed = array_diff($completed, [$lesson_id]);
                $status = false;
            } else {
                // Adiciona
                $completed[] = $lesson_id;
                $status = true;
            }
            
            // Limpa array e garante inteiros únicos
            $clean_completed = array_values(array_unique(array_map('intval', $completed)));
            
            // Salva
            $updated = update_user_meta($user_id, '_nexus_completed_lessons', $clean_completed);
            
            return new WP_REST_Response([
                'success' => true, 
                'is_completed' => $status,
                'total_completed' => count($clean_completed)
            ], 200);
        },
        'permission_callback' => function() { return is_user_logged_in(); }
    ]);
});

// --- 5. STUDIO API (CMS IN-APP) ---

add_action('rest_api_init', function() {

    $can_use_studio = function() {
        return is_user_logged_in() && current_user_can('edit_posts');
    };

    $can_manage_upsell = function() {
        return is_user_logged_in() && current_user_can('manage_options');
    };

    $sanitize_offer = function($payload) use ($can_manage_upsell) {
        // Editor não pode salvar upsell/financeiro
        if (!$can_manage_upsell()) {
            return [
                'access' => isset($payload['access']) ? sanitize_text_field($payload['access']) : 'free',
            ];
        }

        $bullets = [];
        if (isset($payload['offer_bullets']) && is_array($payload['offer_bullets'])) {
            foreach ($payload['offer_bullets'] as $b) {
                $b = trim(wp_strip_all_tags((string)$b));
                if ($b !== '') $bullets[] = $b;
            }
            $bullets = array_slice($bullets, 0, 8);
        }

        return [
            'access' => isset($payload['access']) ? sanitize_text_field($payload['access']) : 'free',
            'checkout_url' => isset($payload['checkout_url']) ? esc_url_raw($payload['checkout_url']) : '',
            'offer_title' => isset($payload['offer_title']) ? sanitize_text_field($payload['offer_title']) : '',
            'offer_price' => isset($payload['offer_price']) ? sanitize_text_field($payload['offer_price']) : '',
            'offer_bullets' => wp_json_encode($bullets),
        ];
    };

    $get_lesson_payload = function($lesson_id) {
        $type = get_post_meta($lesson_id, '_nexus_type', true) ?: 'video';
        $status = get_post_status($lesson_id);
        $module_terms = get_the_terms($lesson_id, 'nexus_module');
        $module_id = ($module_terms && !is_wp_error($module_terms)) ? (int)$module_terms[0]->term_id : 0;

        $offer_bullets = get_post_meta($lesson_id, '_nexus_offer_bullets', true);
        $decoded_bullets = [];
        if ($offer_bullets) {
            $tmp = json_decode($offer_bullets, true);
            if (is_array($tmp)) $decoded_bullets = $tmp;
        }

        return [
            'id' => (int)$lesson_id,
            'title' => get_the_title($lesson_id),
            'status' => $status ?: 'draft',
            'module_id' => $module_id,
            'menu_order' => (int)get_post_field('menu_order', $lesson_id),
            'type' => $type,
            'content' => [
                'html' => get_post_field('post_content', $lesson_id),
                'excerpt' => get_post_field('post_excerpt', $lesson_id),
            ],
            'media' => [
                'video_url' => get_post_meta($lesson_id, '_nexus_video_url', true),
                'pdf_url' => get_post_meta($lesson_id, '_nexus_pdf_url', true),
                'duration' => get_post_meta($lesson_id, '_nexus_duration', true),
                'pages' => get_post_meta($lesson_id, '_nexus_pages', true),
                'read_time' => get_post_meta($lesson_id, '_nexus_read_time', true),
                'code_language' => get_post_meta($lesson_id, '_nexus_code_language', true),
                'code' => get_post_meta($lesson_id, '_nexus_code', true),
                'instructions' => get_post_meta($lesson_id, '_nexus_instructions', true),
                'live_url' => get_post_meta($lesson_id, '_nexus_live_url', true),
                'live_datetime' => get_post_meta($lesson_id, '_nexus_live_datetime', true),
                'live_status' => get_post_meta($lesson_id, '_nexus_live_status', true),
            ],
            'access' => [
                'mode' => get_post_meta($lesson_id, '_nexus_access', true) ?: 'free',
                'checkout_url' => get_post_meta($lesson_id, '_nexus_checkout_url', true),
                'offer_title' => get_post_meta($lesson_id, '_nexus_offer_title', true),
                'offer_price' => get_post_meta($lesson_id, '_nexus_offer_price', true),
                'offer_bullets' => $decoded_bullets,
            ]
        ];
    };

    // COURSES
    register_rest_route('nexus/v1', '/studio/courses', [
        [
            'methods' => 'GET',
            'permission_callback' => $can_use_studio,
            'callback' => function() {
                $courses = get_posts([
                    'post_type' => 'nexus_course',
                    'numberposts' => -1,
                    'orderby' => 'date',
                    'order' => 'DESC',
                    'post_status' => ['publish','draft','pending','private']
                ]);

                $out = [];
                foreach ($courses as $c) {
                    $cover_id = (int) get_post_meta($c->ID, '_nexus_cover_id', true);
$cover_url = $cover_id ? wp_get_attachment_image_url($cover_id, 'medium') : '';
$out[] = [
    'id' => (int)$c->ID,
    'title' => $c->post_title,
    'status' => $c->post_status,
    'date' => mysql2date('c', $c->post_date_gmt ?: $c->post_date, false),
    'cover_id' => $cover_id,
    'cover_url' => $cover_url,
];
                }
                return new WP_REST_Response($out, 200);
            }
        ],
        [
            'methods' => 'POST',
            'permission_callback' => $can_use_studio,
            'callback' => function(WP_REST_Request $req) {
                $p = $req->get_json_params();
                $title = isset($p['title']) ? sanitize_text_field($p['title']) : '';
                if ($title === '') return new WP_REST_Response(['success' => false, 'message' => 'Título é obrigatório.'], 400);

                $post_id = wp_insert_post([
                    'post_type' => 'nexus_course',
                    'post_title' => $title,
                    'post_status' => isset($p['status']) ? sanitize_text_field($p['status']) : 'draft',
                    'post_content' => isset($p['content']) ? wp_kses_post($p['content']) : '',
                    'post_excerpt' => isset($p['excerpt']) ? wp_kses_post($p['excerpt']) : '',
                ], true);

                if (is_wp_error($post_id)) return new WP_REST_Response(['success' => false, 'message' => $post_id->get_error_message()], 500);

if (isset($p['cover_id'])) {
    $cover_id = (int) $p['cover_id'];
    if ($cover_id > 0) update_post_meta($post_id, '_nexus_cover_id', $cover_id);
}

return new WP_REST_Response(['success' => true, 'id' => (int)$post_id], 200);
            }
        ]
    ]);

    register_rest_route('nexus/v1', '/studio/courses/(?P<id>\d+)', [
        [
            'methods' => 'GET',
            'permission_callback' => $can_use_studio,
            'callback' => function($data) {
                $id = (int)$data['id'];
                $p = get_post($id);
                if (!$p || $p->post_type !== 'nexus_course') return new WP_REST_Response(['success' => false, 'message' => 'Curso não encontrado.'], 404);
                $cover_id = (int) get_post_meta($p->ID, '_nexus_cover_id', true);
$cover_url = $cover_id ? wp_get_attachment_image_url($cover_id, 'large') : '';
return new WP_REST_Response([
    'id' => (int)$p->ID,
    'title' => $p->post_title,
    'status' => $p->post_status,
    'content' => $p->post_content,
    'excerpt' => $p->post_excerpt,
    'cover_id' => $cover_id,
    'cover_url' => $cover_url,
], 200);
            }
        ],
        [
            'methods' => 'PUT',
            'permission_callback' => $can_use_studio,
            'callback' => function(WP_REST_Request $req) {
                $id = (int)$req['id'];
                $p = get_post($id);
                if (!$p || $p->post_type !== 'nexus_course') return new WP_REST_Response(['success' => false, 'message' => 'Curso não encontrado.'], 404);

                $payload = $req->get_json_params();
                $update = ['ID' => $id];
                if (isset($payload['title'])) $update['post_title'] = sanitize_text_field($payload['title']);
                if (isset($payload['status'])) $update['post_status'] = sanitize_text_field($payload['status']);
                if (isset($payload['content'])) $update['post_content'] = wp_kses_post($payload['content']);
                if (isset($payload['excerpt'])) $update['post_excerpt'] = wp_kses_post($payload['excerpt']);

                $res = wp_update_post($update, true);
                if (is_wp_error($res)) return new WP_REST_Response(['success' => false, 'message' => $res->get_error_message()], 500);
                if (isset($payload['cover_id'])) {
                    $cover_id = (int) $payload['cover_id'];
                    if ($cover_id > 0) {
                        update_post_meta($id, '_nexus_cover_id', $cover_id);
                    } else {
                        delete_post_meta($id, '_nexus_cover_id');
                    }
                }
                return new WP_REST_Response(['success' => true], 200);
            }
        ],
        [
            'methods' => 'DELETE',
            'permission_callback' => $can_use_studio,
            'callback' => function($data) {
                $id = (int)$data['id'];
                $p = get_post($id);
                if (!$p || $p->post_type !== 'nexus_course') return new WP_REST_Response(['success' => false, 'message' => 'Curso não encontrado.'], 404);
                wp_trash_post($id);
                return new WP_REST_Response(['success' => true], 200);
            }
        ]
    ]);

    // MODULES
    register_rest_route('nexus/v1', '/studio/courses/(?P<id>\d+)/modules', [
        [
            'methods' => 'GET',
            'permission_callback' => $can_use_studio,
            'callback' => function($data) {
                $course_id = (int)$data['id'];
                $terms = get_terms([
                    'taxonomy' => 'nexus_module',
                    'hide_empty' => false,
                    'meta_key' => '_nexus_course_id',
                    'meta_value' => $course_id,
                    'orderby' => 'name',
                    'order' => 'ASC'
                ]);
                $out = [];
                foreach ($terms as $t) {
                    $out[] = ['id' => (int)$t->term_id, 'name' => $t->name];
                }
                return new WP_REST_Response($out, 200);
            }
        ],
        [
            'methods' => 'POST',
            'permission_callback' => $can_use_studio,
            'callback' => function(WP_REST_Request $req) {
                $course_id = (int)$req['id'];
                $p = $req->get_json_params();
                $name = isset($p['name']) ? sanitize_text_field($p['name']) : '';
                if ($name === '') return new WP_REST_Response(['success' => false, 'message' => 'Nome é obrigatório.'], 400);
                $created = wp_insert_term($name, 'nexus_module');
                if (is_wp_error($created)) return new WP_REST_Response(['success' => false, 'message' => $created->get_error_message()], 500);
                update_term_meta((int)$created['term_id'], '_nexus_course_id', $course_id);
                return new WP_REST_Response(['success' => true, 'id' => (int)$created['term_id']], 200);
            }
        ]
    ]);

    register_rest_route('nexus/v1', '/studio/modules/(?P<id>\d+)', [
        [
            'methods' => 'PUT',
            'permission_callback' => $can_use_studio,
            'callback' => function(WP_REST_Request $req) {
                $id = (int)$req['id'];
                $p = $req->get_json_params();
                $name = isset($p['name']) ? sanitize_text_field($p['name']) : '';
                if ($name === '') return new WP_REST_Response(['success' => false, 'message' => 'Nome é obrigatório.'], 400);
                $res = wp_update_term($id, 'nexus_module', ['name' => $name]);
                if (is_wp_error($res)) return new WP_REST_Response(['success' => false, 'message' => $res->get_error_message()], 500);
                return new WP_REST_Response(['success' => true], 200);
            }
        ],
        [
            'methods' => 'DELETE',
            'permission_callback' => $can_use_studio,
            'callback' => function($data) {
                $id = (int)$data['id'];
                $res = wp_delete_term($id, 'nexus_module');
                if (is_wp_error($res)) return new WP_REST_Response(['success' => false, 'message' => $res->get_error_message()], 500);
                return new WP_REST_Response(['success' => true], 200);
            }
        ]
    ]);

    // ITEMS TREE
    register_rest_route('nexus/v1', '/studio/courses/(?P<id>\d+)/items', [
        'methods' => 'GET',
        'permission_callback' => $can_use_studio,
        'callback' => function($data) use ($get_lesson_payload) {
            $course_id = (int)$data['id'];
            $modules = get_terms([
                'taxonomy' => 'nexus_module',
                'hide_empty' => false,
                'meta_key' => '_nexus_course_id',
                'meta_value' => $course_id,
                'orderby' => 'name',
                'order' => 'ASC'
            ]);

            $lessons = get_posts([
                'post_type' => 'nexus_lesson',
                'numberposts' => -1,
                'meta_key' => '_nexus_course_id',
                'meta_value' => $course_id,
                'orderby' => 'menu_order',
                'order' => 'ASC',
                'post_status' => ['publish','draft','pending','private']
            ]);

            $structure = [];
            foreach ($modules as $m) {
                $structure[(int)$m->term_id] = [
                    'id' => (int)$m->term_id,
                    'name' => $m->name,
                    'items' => []
                ];
            }
            // fallback geral
            if (!isset($structure[0])) {
                $structure[0] = ['id' => 0, 'name' => 'Geral', 'items' => []];
            }

            foreach ($lessons as $l) {
                $payload = $get_lesson_payload($l->ID);
                $mid = (int)$payload['module_id'];
                if (!isset($structure[$mid])) {
                    $structure[$mid] = ['id' => $mid, 'name' => 'Geral', 'items' => []];
                }
                $structure[$mid]['items'][] = [
                    'id' => $payload['id'],
                    'title' => $payload['title'],
                    'type' => $payload['type'],
                    'status' => $payload['status'],
                    'menu_order' => $payload['menu_order'],
                ];
            }

            return new WP_REST_Response(['modules' => array_values($structure)], 200);
        }
    ]);

    // ITEM CRUD
    register_rest_route('nexus/v1', '/studio/items', [
        'methods' => 'POST',
        'permission_callback' => $can_use_studio,
        'callback' => function(WP_REST_Request $req) {
            $p = $req->get_json_params();
            $title = isset($p['title']) ? sanitize_text_field($p['title']) : '';
            $course_id = isset($p['course_id']) ? absint($p['course_id']) : 0;
            $module_id = isset($p['module_id']) ? absint($p['module_id']) : 0;
            if ($title === '' || $course_id <= 0) return new WP_REST_Response(['success' => false, 'message' => 'Título e curso são obrigatórios.'], 400);

            $post_id = wp_insert_post([
                'post_type' => 'nexus_lesson',
                'post_title' => $title,
                'post_status' => isset($p['status']) ? sanitize_text_field($p['status']) : 'draft',
                'post_content' => isset($p['content']) ? wp_kses_post($p['content']) : '',
                'post_excerpt' => isset($p['excerpt']) ? wp_kses_post($p['excerpt']) : '',
                'menu_order' => isset($p['menu_order']) ? (int)$p['menu_order'] : 0,
            ], true);

            if (is_wp_error($post_id)) return new WP_REST_Response(['success' => false, 'message' => $post_id->get_error_message()], 500);

            update_post_meta($post_id, '_nexus_course_id', $course_id);
            if ($module_id > 0) {
                wp_set_object_terms($post_id, [$module_id], 'nexus_module', false);
            }

            if (isset($p['type'])) update_post_meta($post_id, '_nexus_type', sanitize_text_field($p['type']));

            return new WP_REST_Response(['success' => true, 'id' => (int)$post_id], 200);
        }
    ]);

    register_rest_route('nexus/v1', '/studio/items/(?P<id>\d+)', [
        [
            'methods' => 'GET',
            'permission_callback' => $can_use_studio,
            'callback' => function($data) use ($get_lesson_payload) {
                $id = (int)$data['id'];
                $p = get_post($id);
                if (!$p || $p->post_type !== 'nexus_lesson') return new WP_REST_Response(['success' => false, 'message' => 'Item não encontrado.'], 404);
                return new WP_REST_Response($get_lesson_payload($id), 200);
            }
        ],
        [
            'methods' => 'PUT',
            'permission_callback' => $can_use_studio,
            'callback' => function(WP_REST_Request $req) use ($sanitize_offer) {
                $id = (int)$req['id'];
                $p = get_post($id);
                if (!$p || $p->post_type !== 'nexus_lesson') return new WP_REST_Response(['success' => false, 'message' => 'Item não encontrado.'], 404);

                $payload = $req->get_json_params();
                $update = ['ID' => $id];
                if (isset($payload['title'])) $update['post_title'] = sanitize_text_field($payload['title']);
                if (isset($payload['status'])) $update['post_status'] = sanitize_text_field($payload['status']);
                if (isset($payload['content'])) $update['post_content'] = wp_kses_post($payload['content']);
                if (isset($payload['excerpt'])) $update['post_excerpt'] = wp_kses_post($payload['excerpt']);
                if (isset($payload['menu_order'])) $update['menu_order'] = (int)$payload['menu_order'];
                $res = wp_update_post($update, true);
                if (is_wp_error($res)) return new WP_REST_Response(['success' => false, 'message' => $res->get_error_message()], 500);

                if (isset($payload['course_id'])) update_post_meta($id, '_nexus_course_id', absint($payload['course_id']));
                if (isset($payload['module_id'])) {
                    $module_id = absint($payload['module_id']);
                    if ($module_id > 0) {
                        wp_set_object_terms($id, [$module_id], 'nexus_module', false);
                    } else {
                        wp_set_object_terms($id, [], 'nexus_module', false);
                    }
                }

                // Tipo e mídia
                if (isset($payload['type'])) update_post_meta($id, '_nexus_type', sanitize_text_field($payload['type']));
                if (isset($payload['media']) && is_array($payload['media'])) {
                    $m = $payload['media'];
                    $map = [
                        'video_url' => 'esc_url_raw',
                        'pdf_url' => 'esc_url_raw',
                        'duration' => 'sanitize_text_field',
                        'pages' => 'sanitize_text_field',
                        'read_time' => 'sanitize_text_field',
                        'code_language' => 'sanitize_text_field',
                        'code' => 'wp_kses_post',
                        'instructions' => 'wp_kses_post',
                        'live_url' => 'esc_url_raw',
                        'live_datetime' => 'sanitize_text_field',
                        'live_status' => 'sanitize_text_field',
                    ];
                    foreach ($map as $k => $fn) {
                        if (array_key_exists($k, $m)) {
                            $val = $m[$k];
                            if ($fn === 'wp_kses_post') $val = wp_kses_post($val);
                            elseif ($fn === 'esc_url_raw') $val = esc_url_raw($val);
                            else $val = sanitize_text_field($val);
                            update_post_meta($id, '_nexus_' . $k, $val);
                        }
                    }
                }

                // Upsell
                if (isset($payload['access']) && is_array($payload['access'])) {
                    $a = $sanitize_offer($payload['access']);
                    if (isset($a['access'])) update_post_meta($id, '_nexus_access', $a['access']);
                    if (isset($a['checkout_url'])) update_post_meta($id, '_nexus_checkout_url', $a['checkout_url']);
                    if (isset($a['offer_title'])) update_post_meta($id, '_nexus_offer_title', $a['offer_title']);
                    if (isset($a['offer_price'])) update_post_meta($id, '_nexus_offer_price', $a['offer_price']);
                    if (isset($a['offer_bullets'])) update_post_meta($id, '_nexus_offer_bullets', $a['offer_bullets']);
                }

                return new WP_REST_Response(['success' => true], 200);
            }
        ],
        [
            'methods' => 'DELETE',
            'permission_callback' => $can_use_studio,
            'callback' => function($data) {
                $id = (int)$data['id'];
                $p = get_post($id);
                if (!$p || $p->post_type !== 'nexus_lesson') return new WP_REST_Response(['success' => false, 'message' => 'Item não encontrado.'], 404);
                wp_trash_post($id);
                return new WP_REST_Response(['success' => true], 200);
            }
        ]
    ]);

    // REORDER
    
// CONTENT TABS (dynamic)
register_rest_route('nexus/v1', '/studio/content-tabs', [
    [
        'methods' => 'GET',
        'permission_callback' => $can_use_studio,
        'callback' => function() {
            $types = ['video','doc','code','live','text'];
            $labels = [
                'video' => 'Vídeos',
                'doc' => 'Documentos',
                'code' => 'Códigos',
                'live' => 'Lives',
                'text' => 'Textos',
            ];
            $out = [];
            foreach ($types as $t) {
                $q = new WP_Query([
                    'post_type' => 'nexus_lesson',
                    'post_status' => ['publish','draft','pending','private'],
                    'posts_per_page' => 1,
                    'meta_key' => '_nexus_type',
                    'meta_value' => $t
                ]);
                if ($q->found_posts > 0) {
                    $out[] = ['type' => $t, 'label' => $labels[$t] ?? strtoupper($t)];
                }
                wp_reset_postdata();
            }
            return new WP_REST_Response($out, 200);
        }
    ]
]);

// CONTENT LISTING (by type)
register_rest_route('nexus/v1', '/studio/content', [
    [
        'methods' => 'GET',
        'permission_callback' => $can_use_studio,
        'callback' => function(WP_REST_Request $req) {
            $type = sanitize_text_field($req->get_param('type') ?: '');
            $allowed = ['video','doc','code','live','text'];
            if ($type === '' || !in_array($type, $allowed, true)) {
                return new WP_REST_Response(['success' => false, 'message' => 'Tipo inválido.'], 400);
            }

            $items = get_posts([
                'post_type' => 'nexus_lesson',
                'numberposts' => 200,
                'orderby' => 'date',
                'order' => 'DESC',
                'post_status' => ['publish','draft','pending','private'],
                'meta_key' => '_nexus_type',
                'meta_value' => $type
            ]);

            $out = [];
            foreach ($items as $p) {
                $course_id = (int) get_post_meta($p->ID, '_nexus_course_id', true);
                $module_id = 0;
                $terms = wp_get_post_terms($p->ID, 'nexus_module');
                if (!is_wp_error($terms) && !empty($terms)) {
                    $module_id = (int) $terms[0]->term_id;
                }

                $out[] = [
                    'id' => (int)$p->ID,
                    'title' => $p->post_title,
                    'status' => $p->post_status,
                    'course_id' => $course_id,
                    'module_id' => $module_id,
                    'date' => mysql2date('c', $p->post_date_gmt ?: $p->post_date, false),
                ];
            }

            return new WP_REST_Response($out, 200);
        }
    ]
]);

// MEDIA UPLOAD (Studio)
register_rest_route('nexus/v1', '/studio/media', [
    [
        'methods' => 'POST',
        'permission_callback' => $can_use_studio,
        'callback' => function(WP_REST_Request $req) {
            $files = $req->get_file_params();
            if (!isset($files['file'])) {
                return new WP_REST_Response(['success' => false, 'message' => 'Arquivo não enviado.'], 400);
            }

            $file = $files['file'];
            if (!function_exists('wp_handle_upload')) require_once ABSPATH . 'wp-admin/includes/file.php';
            if (!function_exists('wp_generate_attachment_metadata')) require_once ABSPATH . 'wp-admin/includes/image.php';
            if (!function_exists('wp_insert_attachment')) require_once ABSPATH . 'wp-admin/includes/media.php';

            $overrides = ['test_form' => false];
            $uploaded = wp_handle_upload($file, $overrides);

            if (isset($uploaded['error'])) {
                return new WP_REST_Response(['success' => false, 'message' => $uploaded['error']], 500);
            }

            $filetype = wp_check_filetype($uploaded['file']);
            $attachment = [
                'post_mime_type' => $filetype['type'],
                'post_title' => sanitize_file_name(basename($uploaded['file'])),
                'post_content' => '',
                'post_status' => 'inherit'
            ];

            $attach_id = wp_insert_attachment($attachment, $uploaded['file']);
            if (is_wp_error($attach_id)) {
                return new WP_REST_Response(['success' => false, 'message' => $attach_id->get_error_message()], 500);
            }

            $attach_data = wp_generate_attachment_metadata($attach_id, $uploaded['file']);
            wp_update_attachment_metadata($attach_id, $attach_data);

            $url = wp_get_attachment_url($attach_id);
            return new WP_REST_Response(['success' => true, 'id' => (int)$attach_id, 'url' => $url], 200);
        }
    ]
]);

register_rest_route('nexus/v1', '/studio/reorder', [
        'methods' => 'POST',
        'permission_callback' => $can_use_studio,
        'callback' => function(WP_REST_Request $req) {
            $p = $req->get_json_params();
            $ordered = isset($p['ordered_item_ids']) && is_array($p['ordered_item_ids']) ? array_values(array_map('intval', $p['ordered_item_ids'])) : [];
            if (empty($ordered)) return new WP_REST_Response(['success' => false, 'message' => 'ordered_item_ids vazio.'], 400);

            foreach ($ordered as $idx => $id) {
                wp_update_post(['ID' => $id, 'menu_order' => $idx], true);
            }
            return new WP_REST_Response(['success' => true], 200);
        }
    ]);
});