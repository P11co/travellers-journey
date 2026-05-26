import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function RenderedScreen() {
  return (
    <ScrollView style={styles.container}>
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>AI Chat Interface</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style data-purpose="custom-styles">
    body {
        background-color: #0d0d0d;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
    }
    
    /* Subtle glowing effect for circles */
    .glow-circle {
      box-shadow: 0 0 40px rgba(92, 119, 255, 0.15);
    }
    
    /* Grid background pattern */
    .bg-grid-pattern {
      background-image: 
        linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 50px 50px;
    }

    .nav-pill {
        background-color: #1a1a1a;
        border: 1px solid #333;
        border-radius: 9999px
    }
    .msg-buddy {
        background-color: #1f1f1f;
        border: 1px solid #333;
        color: #e5e5e5
    }
    .msg-user {
        background-color: #5c77ff;
        color: #fff
    }
    .live-preview {
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        border: 2px solid #5c77ff;
        transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .live-preview.hidden-preview {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
    }
    .input-bar {
        background-color: #0d0d0d;
        border-top: 1px solid #333
    }
    .input-field {
        background-color: #1a1a1a;
        border: 1px solid #333
    }
    .action-sidebar {
        background-color: #151515;
        border-left: 1px solid #222;
    }
    .chat-scroll::-webkit-scrollbar {
        width: 4px
    }
    .chat-scroll::-webkit-scrollbar-track {
        background: transparent
    }
    .chat-scroll::-webkit-scrollbar-thumb {
        background-color: #333;
        border-radius: 20px
    }

    /* --- Animations --- */
    @keyframes slideUpElastic {
        0% { transform: translateY(100%); opacity: 0; }
        60% { transform: translateY(-10px); opacity: 1; }
        80% { transform: translateY(5px); }
        100% { transform: translateY(0); }
    }

    @keyframes popIn {
        0% { transform: scale(0.95); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }

    @keyframes bounceVertical {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
    }

    @keyframes scanline {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
    }

    .animate-entrance {
        animation: slideUpElastic 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.1) forwards;
    }

    .chat-bubble-pop {
        animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        opacity: 0;
    }

    .bounce-handle {
        animation: bounceVertical 2s ease-in-out infinite;
    }

    .scan-line {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(to right, transparent, rgba(92, 119, 255, 0.5), transparent);
        box-shadow: 0 0 8px rgba(92, 119, 255, 0.8);
        animation: scanline 3s linear infinite;
        z-index: 15;
    }

    .active-scale:active {
        transform: scale(0.9);
    }
    
    .transition-transform {
        transition: transform 0.1s ease;
    }

    @media (prefers-reduced-motion: reduce) {
        .animate-entrance, .chat-bubble-pop, .bounce-handle, .scan-line {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
        }
    }
</style>
</head>
<body class="h-screen w-full flex justify-center items-center bg-black overflow-hidden relative">
<!-- Mobile Device Container -->
<View>
<View>
<View></View>
<View></View>
<View></View>
<svg class="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
<line stroke="#5c77ff" stroke-dasharray="4 4" stroke-width="1" x1="0%" x2="100%" y1="20%" y2="40%"></line>
<line stroke="#5c77ff" stroke-dasharray="4 4" stroke-width="1" x1="0%" x2="100%" y1="80%" y2="60%"></line>
</svg>
</View>
<!-- BEGIN: Chat Interface Overlay Container -->
<View>
<!-- Swipe Bar & Navbar Hump Area -->
<View>
<!-- Swipe Bar -->
<View></View>
<!-- Navbar Hump -->
<nav class="nav-pill flex items-center px-6 py-2 space-x-8 shadow-2xl mb-[-24px] relative z-50">
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
<Text></path>
</svg>
</TouchableOpacity>
</nav>
</View>
<!-- Main Content Area with Chat and Sidebar -->
<View>
<!-- Scrollable Chat Area -->
<View>
<!-- Timestamp -->
<View>TODAY 14:32</View>
<!-- Buddy Message 1 -->
<View>
<View>
<svg class="h-4 w-4" fill="currentColor" style="color: #5c77ff;" viewbox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
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
<svg class="h-4 w-4" fill="currentColor" style="color: #5c77ff;" viewbox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</View>
<View>
                        I can see you're currently in the Gangnam-daero area. Are you looking for the nearest subway station or a specific recommendation for dinner?
                    </View>
</View>
<View>BUDDY • 14:02</View>
</View>
<!-- User Message 2 with Floating Live Preview -->
<View>
<!-- Floating Live Video Preview -->
<View>
<View>
<View></View>
<span class="text-[9px] font-bold text-white tracking-wider">LIVE</span>
</View>
<View></View>
<img alt="Live Street View" class="w-full h-full object-cover opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBllltC9AnxYNQ2ruV_vSXtbC6KYCTJPcW0uPjG_exgwXwqwydFptOpxAi2G3_S1k5o2OkqiWmAFU6lnVa-wTDVUSc3TaygBQzHjeKR49KsMjj7AtmIWb1KmYPy_pkFMTy-n4dEZv1L1RgHScNd-q3OPyrCv1scPm8DOrAKVUWCfi5pePguSyWUPEcknYwsZNh7KlB-ctHakcIg75iVYe-6CH_GprEJfPDnX07eHUe7obvSyp7EG8B7CXBPtT13Ai1WKhZvMw8qNEeY"/>
</View>
<View>
                    I'm looking for a highly-rated BBQ spot nearby. Can you show me the way?
                </View>
<View>YOU • 14:03</View>
</View>
</View>
<!-- Right Sidebar (Camera, Mic, Sound) -->
<View>
<View></View>
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<View></View>
</View>
</View>
</View>
<!-- END: Chat Interface Overlay Container -->
<!-- BEGIN: Bottom Input Bar -->
<View>
<View>
<TouchableOpacity>
<svg class="h-5 w-5" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<input class="flex-1 bg-transparent border-none text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-0 p-0 text-sm" placeholder="Ask AI..." type="text"/>
<TouchableOpacity>
<svg class="h-4 w-4" fill="none" stroke="currentColor" style="color: #5c77ff;" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
</View>
<!-- Right Menu Button -->
<TouchableOpacity>
<svg class="h-5 w-5" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
</View>
<!-- END: Bottom Input Bar -->
</View>
<script>
    // Micro-interactions and triggers
    document.addEventListener('DOMContentLoaded', () => {
        const sendBtn = document.getElementById('send-button');
        const cameraBtn = document.getElementById('toggle-camera');
        const viewfinder = document.getElementById('camera-viewfinder');
        
        // Toggle camera viewfinder visibility
        if (cameraBtn && viewfinder) {
            cameraBtn.addEventListener('click', () => {
                viewfinder.classList.toggle('hidden-preview');
                
                // Visual feedback for the button state
                if (viewfinder.classList.contains('hidden-preview')) {
                    cameraBtn.classList.remove('text-white');
                    cameraBtn.classList.add('text-gray-500');
                } else {
                    cameraBtn.classList.add('text-white');
                    cameraBtn.classList.remove('text-gray-500');
                }
            });
        }
        
        // Ensuring interactions feel snappy
        const buttons = document.querySelectorAll('.active-scale');
        buttons.forEach(btn => {
            btn.addEventListener('touchstart', () => {
                btn.style.transform = 'scale(0.9)';
            }, {passive: true});
            btn.addEventListener('touchend', () => {
                btn.style.transform = 'scale(1)';
            }, {passive: true});
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
