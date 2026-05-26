import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function RenderedScreen() {
  return (
    <ScrollView style={styles.container}>
<!DOCTYPE html><html class="dark" lang="en"><head>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>AI Chat Interface</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "surface": "#0d0d0d",
                        "surface-container-high": "#1a1a1a",
                        "surface-variant": "#1f1f1f",
                        "tertiary-fixed-dim": "#c9c4d6",
                        "tertiary-fixed": "#e5e0f2",
                        "secondary-fixed": "#6ffbbe",
                        "primary-fixed": "#dee1ff",
                        "on-tertiary-container": "#2a2835",
                        "on-primary-container": "#ffffff",
                        "inverse-on-surface": "#313030",
                        "on-surface-variant": "#9ca3af",
                        "inverse-surface": "#e5e2e1",
                        "tertiary-container": "#928e9f",
                        "outline-variant": "#333333",
                        "primary-container": "#5c77ff",
                        "primary-fixed-dim": "#bac3ff",
                        "error": "#ef4444",
                        "surface-container-lowest": "#000000",
                        "on-surface": "#ffffff",
                        "surface-dim": "#0d0d0d",
                        "background": "#0d0d0d",
                        "on-tertiary": "#312f3c",
                        "on-secondary-fixed": "#002113",
                        "surface-bright": "#1f1f1f",
                        "on-secondary": "#003824",
                        "surface-container": "#1a1a1a",
                        "surface-container-low": "#141414",
                        "error-container": "#93000a",
                        "on-tertiary-fixed-variant": "#484553",
                        "secondary": "#4edea3",
                        "on-tertiary-fixed": "#1c1a27",
                        "on-secondary-container": "#00311f",
                        "secondary-container": "#00a572",
                        "on-primary": "#ffffff",
                        "on-error": "#ffffff",
                        "inverse-primary": "#324fd8",
                        "surface-tint": "#5c77ff",
                        "surface-container-highest": "#333333",
                        "on-background": "#ffffff",
                        "on-primary-fixed-variant": "#0a33c0",
                        "on-primary-fixed": "#001159",
                        "outline": "#4b5563",
                        "tertiary": "#c9c4d6",
                        "secondary-fixed-dim": "#4edea3",
                        "primary": "#5c77ff",
                        "on-secondary-fixed-variant": "#005236",
                        "on-error-container": "#ffdad6"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    },
                    "spacing": {
                        "card-gap": "16px",
                        "lg": "24px",
                        "xs": "8px",
                        "md": "16px",
                        "container-padding": "20px",
                        "xl": "32px",
                        "sm": "12px",
                        "base": "4px"
                    },
                    "fontFamily": {
                        "body-lg": ["Inter"],
                        "label-sm": ["Inter"],
                        "headline-md": ["Inter"],
                        "headline-xl": ["Inter"],
                        "body-md": ["Inter"],
                        "label-md": ["Inter"],
                        "headline-lg": ["Inter"],
                        "body-sm": ["Inter"]
                    },
                    "fontSize": {
                        "body-lg": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                        "label-sm": ["11px", {"lineHeight": "14px", "fontWeight": "500"}],
                        "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
                        "headline-xl": ["32px", {"lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                        "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
                        "label-md": ["14px", {"lineHeight": "20px", "letterSpacing": "0.05em", "fontWeight": "600"}],
                        "headline-lg": ["24px", {"lineHeight": "32px", "fontWeight": "700"}],
                        "body-sm": ["12px", {"lineHeight": "16px", "fontWeight": "400"}]
                    }
                },
            },
        }
    </script>
<style data-purpose="custom-styles">
        body {
            background-color: #0d0d0d;
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* 1. Immersive Scene Background Animation */
        .neon-gradient-bg {
            position: absolute;
            inset: 0;
            background: linear-gradient(125deg, #0d0d0d 0%, #1a1a1a 100%);
            z-index: -1;
        }
        
        .neon-gradient-bg::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 50% 50%, rgba(92, 119, 255, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(78, 222, 163, 0.05) 0%, transparent 40%),
                        radial-gradient(circle at 20% 80%, rgba(201, 196, 214, 0.05) 0%, transparent 40%);
            animation: neonShift 15s ease-in-out infinite alternate;
        }

        @keyframes neonShift {
            0% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.1) translate(2%, 2%); }
            100% { opacity: 0.5; transform: scale(1) translate(-2%, -2%); }
        }

        /* 2. Sidebar Snap Animation */
        .action-sidebar {
            background-color: #1a1a1a;
            border-radius: 9999px;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform: translateX(0);
            opacity: 1;
        }

        .action-sidebar.hidden-sidebar {
            opacity: 0;
            transform: translateX(60px) scale(0.9);
            pointer-events: none;
        }

        /* 3. Viewfinder Focus Animation */
        .focus-bracket {
            position: absolute;
            width: 12px;
            height: 12px;
            border: 1.5px solid rgba(255, 255, 255, 0.6);
            transition: all 0.3s ease;
            z-index: 30;
        }
        .bracket-tl { top: 12px; left: 12px; border-right: 0; border-bottom: 0; }
        .bracket-tr { top: 12px; right: 12px; border-left: 0; border-bottom: 0; }
        .bracket-bl { bottom: 12px; left: 12px; border-right: 0; border-top: 0; }
        .bracket-br { bottom: 12px; right: 12px; border-left: 0; border-top: 0; }

        @keyframes focusing {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(0.85); opacity: 1; }
        }

        .focus-active .focus-bracket {
            animation: focusing 2s ease-in-out infinite;
        }

        /* 4. Chat Spring Animation */
        .chat-message {
            animation: springIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.1) forwards;
            opacity: 0;
            transform: translateY(10px) scale(0.98);
        }

        @keyframes springIn {
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Message delay styling */
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }
        .delay-5 { animation-delay: 0.5s; }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
            .neon-gradient-bg::after, .focus-active .focus-bracket, .chat-message {
                animation: none !important;
                transition: none !important;
                opacity: 1 !important;
                transform: none !important;
            }
        }

        .glow-circle {
            box-shadow: 0 0 40px rgba(92, 119, 255, 0.15);
        }

        .bg-grid-pattern {
            background-image: 
                linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 50px 50px;
        }

        .nav-pill {
            background-color: #1a1a1a;
            border: 1px solid #333333;
            border-radius: 9999px;
        }

        .msg-buddy {
            background-color: #1f1f1f;
            border: 1px solid #333333;
            color: #e5e5e5;
        }

        .msg-user {
            background-color: #5c77ff;
            color: #ffffff;
        }

        .live-preview {
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
            border: 2px solid #5c77ff;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .hidden-viewfinder {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
            pointer-events: none;
        }

        .input-bar {
            background-color: #0d0d0d;
            border-top: 1px solid #333333;
        }

        .input-field {
            background-color: #1a1a1a;
            border: 1px solid #333333;
        }

        .chat-scroll::-webkit-scrollbar {
            width: 4px;
        }

        .chat-scroll::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-scroll::-webkit-scrollbar-thumb {
            background-color: #333333;
            border-radius: 20px;
        }
    </style>
</head>
<body class="h-screen w-full flex justify-center items-center bg-black overflow-hidden relative">
<!-- Mobile Device Container -->
<View>
<!-- Background Effect -->
<View></View>
<View></View>
<!-- Swipe Down Navigation Simulation -->
<View></View>
<!-- BEGIN: Top Navigation Pill -->
<View>
<nav class="nav-pill w-full flex items-center justify-between px-6 py-3 shadow-lg bg-surface-container/80 backdrop-blur-md border border-outline-variant rounded-full">
<TouchableOpacity>
<span class="material-symbols-outlined text-[20px]">calendar_today</span>
</TouchableOpacity>
<TouchableOpacity>
<svg class="h-5 w-5 text-on-primary-container" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<span class="material-symbols-outlined text-[20px]">settings</span>
</TouchableOpacity>
</nav>
</View>
<!-- BEGIN: Chat Interface Overlay -->
<View>
<!-- Scrollable Chat Area -->
<View>
<View>TODAY 14:32</View>
<!-- Buddy Message 1 -->
<View>
<View>
<svg class="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</View>
<View>
                    I noticed you're near the central district. The weather is clearing up. Want me to adjust the walking route to include the park?
                </View>
</View>
<!-- User Message 1 -->
<View>
<View>
                    Yes, let's do that. Is there a coffee shop on the way?
                </View>
</View>
<!-- Buddy Message 2 -->
<View>
<View>
<View>
<svg class="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</View>
<View>
<Text>Certainly! "Yukjeon Sikdang" is just 300 meters away and is famous for its premium pork. I've prepared the navigation for you.</Text>
<TouchableOpacity>
<svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
<span class="font-bold text-white text-base">Open in Naver</span>
</TouchableOpacity>
</View>
</View>
<View>BUDDY • 14:03</View>
</View>
<!-- User Message 2 -->
<View>
<View>
                    I'm looking for a highly-rated BBQ spot nearby. Can you show me the way on Naver Maps?
                </View>
<View>YOU • 14:03</View>
</View>
</View>
<!-- Action Sidebar (Camera, Mic, Sound) -->
<View>
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
</View>
<!-- Camera Viewfinder -->
<View>
<!-- Focusing Brackets -->
<View></View>
<View></View>
<View></View>
<View></View>
<View>
<View></View>
<span class="text-[9px] font-bold text-white tracking-wider">LIVE</span>
</View>
<img alt="City Street POV" class="w-full h-full object-cover opacity-90" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBllltC9AnxYNQ2ruV_vSXtbC6KYCTJPcW0uPjG_exgwXwqwydFptOpxAi2G3_S1k5o2OkqiWmAFU6lnVa-wTDVUSc3TaygBQzHjeKR49KsMjj7AtmIWb1KmYPy_pkFMTy-n4dEZv1L1RgHScNd-q3OPyrCv1scPm8DOrAKVUWCfi5pePguSyWUPEcknYwsZNh7KlB-ctHakcIg75iVYe-6CH_GprEJfPDnX07eHUe7obvSyp7EG8B7CXBPtT13Ai1WKhZvMw8qNEeY">
<View></View>
</View>
</View>
<!-- END: Chat Interface Overlay -->
<!-- BEGIN: Bottom Input Bar -->
<View>
<View>
<TouchableOpacity>
<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<input class="flex-1 bg-transparent border-none text-on-surface-variant placeholder-outline focus:outline-none focus:ring-0 p-0 text-sm" placeholder="Ask AI..." type="text">
<TouchableOpacity>
<svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
</View>
<!-- Toggle Menu Button -->
<TouchableOpacity>
<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
</View>
<!-- END: Bottom Input Bar -->
</View>
<script>
    const menuToggle = document.getElementById('menuToggle');
    const actionSidebar = document.getElementById('actionSidebar');
    const camBtn = document.getElementById('camBtn');
    const cameraViewfinder = document.getElementById('cameraViewfinder');

    // Toggle Right Sidebar (Function Bar)
    menuToggle.addEventListener('click', () => {
        actionSidebar.classList.toggle('hidden-sidebar');
    });

    // Toggle Camera Viewfinder
    camBtn.addEventListener('click', () => {
        const isHidden = cameraViewfinder.classList.contains('hidden-viewfinder');
        
        if (isHidden) {
            cameraViewfinder.classList.remove('hidden-viewfinder');
            camBtn.classList.add('text-primary');
            camBtn.classList.remove('text-on-surface-variant');
        } else {
            cameraViewfinder.classList.add('hidden-viewfinder');
            camBtn.classList.remove('text-primary');
            camBtn.classList.add('text-on-surface-variant');
        }
    });

    // Re-trigger chat animations on mount for a fresh feel
    window.addEventListener('DOMContentLoaded', () => {
        const messages = document.querySelectorAll('.chat-message');
        messages.forEach((msg, index) => {
            msg.style.opacity = '0';
            setTimeout(() => {
                msg.style.animation = 'none';
                msg.offsetHeight; // trigger reflow
                msg.style.animation = null;
            }, 50);
        });
    });
</script>
</body></html>    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    padding: 16,
  },
});
