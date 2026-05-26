import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function RenderedScreen() {
  return (
    <ScrollView style={styles.container}>
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Current Itinerary</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style data-purpose="custom-styles">
    body {
      background-color: #0f1014;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    .timeline-line {
      position: absolute;
      left: 1.25rem;
      top: 2rem;
      bottom: 0;
      width: 1px;
      background-color: #2a2a2a;
      z-index: 0;
    }
    
    .timeline-icon {
      position: relative;
      z-index: 1;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #1a1b1e;
      border: 1px solid #2a2a2a;
    }
    
    .timeline-icon-active {
      background-color: #5c77ff;
      border: none;
    }

    .card-bg {
      background-color: #1a1b1e;
      border: 1px solid #2a2a2a;
    }
    
    .text-muted {
      color: #9ca3af;
    }

    .bottom-nav {
      background-color: rgba(26, 27, 30, 0.9);
      backdrop-filter: blur(10px);
    }
  
    .active-scale:active {
        transform: scale(0.9);
    }
    .transition-transform {
        transition: transform 0.1s ease;
    }
    </style>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/><link class="" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/></head>
<body class="antialiased pb-24">
<!-- BEGIN: Header -->
<header class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
<View>
<svg class="w-6 h-6 text-[#5c77ff]" fill="currentColor" viewbox="0 0 24 24">
<Text></path>
</svg>
<span class="text-xl font-bold tracking-tight">Buddy</span>
</View>
<View>
<img alt="User Profile" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxZsY8UA-aP846TF_RUfnj7Yc5i5RktEqrb7kYyJ0DjBO6yLKt3Z82fd0GC-5AvBoXGvnRZg5Cm9BnIwYwPGMjWymEJiI_7XJ97jtdBy4fNGM_4wjC-wgfqiIv5bdnx0-Iw0jY9mwjPPKMZjwejZgIRnRomINr7mK6SI9Hl27cOeDbyRCKtIsptZ72t2r_h143PlIgkdrMLjQSjRoIS0BZbIrRl9DBatwrpCX_8Ym2mubr6ePUQ7pKcVUD8ueQQmympe7P7rQDS7IG"/>
</View>
</header>
<!-- END: Header -->
<!-- BEGIN: Main Content -->
<main class="px-4 pt-6 pb-8">
<Text>Current Itinerary</Text>
<!-- Summary Card -->
<View>
<View>
<View>
<svg class="w-5 h-5 text-[#5c77ff]" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<Text></path>
<Text></path>
</svg>
</View>
<View>
<Text>Gyeongbokgung Palace</Text>
<Text>Seoul, South Korea</Text>
</View>
</View>
<View>
<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<Text></path>
</svg>
<span class="text-sm font-medium">8 Hours</span>
</View>
</View>
<!-- Timeline Container -->
<View>
<!-- Continuous line -->
<View></View>
<!-- Item 1 -->
<View>
<View>
<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<Text></path>
</svg>
</View>
<View>
<img alt="Gyeongbokgung Palace" class="w-full h-32 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIOF0p6EFK2rto3QhYb6iS8ik_6LtjmrmKK6b_oJApYytSNgNnAD62wRUB0Q_3U_C39ii5j7VKvnNZ5OWBJ9X4Oe5HOHxjU3ychBMvS27aZG05F_A-lbIo5MppmAew5BRj1SlV1Bj-MBu15UIPF0_oz3unwIazTVDDhYz63DJ1xJGYjJB373R0Z8K4uap5sQAxHavpP70RcJq3YTsUnwj77lyMDl_FShWQsypiN4LJL47e8cu33o6Dah9O0DzJkjJ0FDLo5s02O7qT"/>
<View>
<View>
<Text>Gyeongbokgung Palace</Text>
<span class="text-xs font-mono text-green-400">09:00 AM</span>
</View>
<Text>Experience the grandeur of the main royal palace of the Joseon dynasty.</Text>
</View>
</View>
</View>
<!-- Item 2 -->
<View>
<View>
<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<Text></path>
<Text></path>
</svg>
</View>
<View>
<View>
<Text>Bukchon Hanok Village</Text>
<span class="text-xs font-mono text-gray-400">11:30 AM</span>
</View>
<Text>Wander through hundreds of traditional houses, called hanok, that date back to the Joseon dynasty.</Text>
</View>
</View>
<!-- Item 3 -->
<View>
<View>
<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<Text></path>
</svg>
</View>
<View>
<View>
<Text>Lunch in Insadong</Text>
<span class="text-xs font-mono text-gray-400">01:30 PM</span>
</View>
<View>
<span class="text-[10px] font-bold px-2 py-1 rounded bg-green-900/30 text-green-400 border border-green-800">TOP CHOICE</span>
<span class="text-[10px] font-bold px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700">TRADITIONAL</span>
</View>
<Text>Enjoy authentic Korean cuisine in the heart of Seoul's traditional cultural district.</Text>
</View>
</View>
<!-- Item 4 -->
<View>
<View>
<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<Text></path>
</svg>
</View>
<View>
<img alt="N Seoul Tower" class="w-full h-32 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCxwAkiizbDZmGJu-Whk-m0T-khcftLHkwric-DlUMgTI4z7uGTmbw_d5yUaoDAWNgzDv0DQ79UfrDKBLPF9WogEtUtMdsaK9cgm0bfHMbZItGcu0zMchfoTuUn_7Gv4QaERr_hCaVEiH8nL3lOwYP0vw6CCGMlCPCweyLEoCYQfflTyAX7bR4N68RKPF6swEmfewW6xEJ8tlsRb3Hdq8GZPr-2syllab4nEJnkeTEx9sJ3et3IEDsMjhdXD3cexKJOStQoMCbqOmjK"/>
<View>
<View>
<Text>N Seoul Tower</Text>
<span class="text-xs font-mono text-gray-400">04:00 PM</span>
</View>
<Text>Catch the sunset and panoramic city views from the highest point in Seoul.</Text>
</View>
</View>
</View>
</View>
<!-- Action Buttons -->
<View>
<TouchableOpacity>
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<Text></path>
</svg>
        Edit Plan
      </TouchableOpacity>
<TouchableOpacity>
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewbox="0 0 24 24">
<Text></path>
</svg>
        Scrap &amp; Restart
      </TouchableOpacity>
</View>
</main>
<!-- END: Main Content -->
<!-- BEGIN: Bottom Navigation -->
<!-- END: Bottom Navigation -->
<!-- BEGIN: Bottom Floating Navigation (3-Item) -->
<View>
<nav class="nav-pill flex items-center px-6 py-2 space-x-8 shadow-2xl relative bg-opacity-90 backdrop-blur-md" style="background-color: #1a1a1a; border: 1px solid #333; border-radius: 9999px;">
<!-- Active State: Itinerary/Plan -->
<TouchableOpacity>
<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<!-- Chat Link -->
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<!-- Settings Link -->
<TouchableOpacity>
<svg class="h-6 w-6" fill="none" stroke="currentColor" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
<Text></path>
</svg>
</TouchableOpacity>
</nav>
</View>
<!-- END: Bottom Floating Navigation (3-Item) --></body></html>    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    padding: 16,
  },
});
