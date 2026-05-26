import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function RenderedScreen() {
  return (
    <ScrollView style={styles.container}>
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>AR/Map Navigation View</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            custom: {
              bg: '#0f0f13',
              grid: '#1f1f23',
              accent: '#5c77ff',
              accentLight: '#8ca1ff',
              accentDark: '#3b4ccb',
              surface: '#18181b',
              surfaceLight: '#27272a',
            }
          },
          fontFamily: {
            sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
          }
        }
      }
    }
  </script>
<style data-purpose="custom-utilities">
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

    /* Soft inner glow for floating panels */
    .panel-shadow {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    /* Animations */
    @keyframes breathing-grid {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.02); }
    }

    @keyframes radar-pulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(2.5); opacity: 0; }
    }

    @keyframes bobbing {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    @keyframes slide-down-bounce {
      0% { transform: translateY(-150%); opacity: 0; }
      70% { transform: translateY(10%); opacity: 1; }
      100% { transform: translateY(0); opacity: 1; }
    }

    @keyframes amber-pulse {
      0%, 100% { border-color: rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
      50% { border-color: rgba(251, 191, 36, 0.4); box-shadow: 0 8px 32px rgba(251, 191, 36, 0.15); }
    }

    .animate-breathing {
      animation: breathing-grid 8s ease-in-out infinite;
    }

    .animate-radar::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      border: 1px solid rgba(140, 161, 255, 0.5);
      animation: radar-pulse 3s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
    }

    .animate-bob {
      animation: bobbing 4s ease-in-out infinite;
    }

    .animate-alert-entry {
      animation: slide-down-bounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                 amber-pulse 3s ease-in-out infinite 1s;
    }

    @media (prefers-reduced-motion: reduce) {
      .animate-breathing, .animate-radar::before, .animate-bob, .animate-alert-entry {
        animation: none !important;
      }
      .animate-alert-entry {
        transform: translateY(0);
        opacity: 1;
      }
    }
  </style>
<style data-purpose="layout-fixes">
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
      background-color: #0f0f13; /* Fallback */
    }
  </style>
</head>
<body class="bg-custom-bg text-white font-sans antialiased h-screen w-screen overflow-hidden relative font-medium">
<!-- BEGIN: Map Background -->
<View>
<!-- Decorative Circle Top Right -->
<View></View>
<!-- Decorative Circle Mid Left -->
<View></View>
<!-- Decorative Circle Bottom Right -->
<View></View>
<!-- Perspective Grid Lines (Simulation) -->
<svg class="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
<line stroke="#5c77ff" stroke-dasharray="4 4" stroke-width="1" x1="0%" x2="100%" y1="20%" y2="40%"></line>
<line stroke="#5c77ff" stroke-dasharray="4 4" stroke-width="1" x1="0%" x2="100%" y1="80%" y2="60%"></line>
</svg>
</View>
<!-- END: Map Background -->
<!-- BEGIN: Top Notification -->
<View>
<View>
<!-- Icon Container -->
<View>
<svg class="h-6 w-6 text-custom-accentLight" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
<Text></path>
</svg>
</View>
<!-- Text Content -->
<View>
<Text>Watch your step</Text>
<Text>Approaching uneven terrain.</Text>
</View>
</View>
</View>
<!-- END: Top Notification -->
<!-- BEGIN: Current Location Marker -->
<View>
<!-- Pulsing Radar Circle -->
<View>
<View></View>
<!-- Pin Icon Container -->
<View>
<svg class="h-8 w-8" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</View>
</View>
<!-- Label Pill -->
<View>
<View></View>
<span class="text-[10px] font-bold tracking-wider text-gray-200 uppercase">Current Location</span>
</View>
</View>
<!-- END: Current Location Marker -->
<!-- BEGIN: Bottom Navigation Bar -->
<View>
<nav class="w-full max-w-sm bg-custom-surface/95 backdrop-blur-xl border border-white/5 rounded-3xl h-20 flex items-center justify-around px-2 panel-shadow relative">
<!-- Nav Item 1: Calendar/Events -->
<TouchableOpacity>
<svg class="h-6 w-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<!-- Nav Item 2: Main Action (Chat/Communicate) -->
<View>
<TouchableOpacity>
<svg class="h-8 w-8" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
</View>
<!-- Nav Item 3: Settings -->
<TouchableOpacity>
<svg class="h-6 w-6 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
<Text></path>
</svg>
</TouchableOpacity>
</nav>
</View>
<!-- END: Bottom Navigation Bar -->
<script>
  // Script to handle interactive micro-transitions if needed
  document.addEventListener('DOMContentLoaded', () => {
    // Add subtle hover/tilt effect to the notification card using JS for precision
    const notification = document.querySelector('[data-purpose="top-notification"] > div');
    
    if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      notification.addEventListener('mousemove', (e) => {
        const rect = notification.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        notification.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });
      
      notification.addEventListener('mouseleave', () => {
        notification.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
      });
    }
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
