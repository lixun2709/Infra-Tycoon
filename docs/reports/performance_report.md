# Performance Report

## Overview
The ECS world maintains high cache-hit rates due to O(1) query indexing. Rerenders on the UI side were drastically minimized by consolidating useInfraStore hooks into precise useShallow selectors for discrete domains.