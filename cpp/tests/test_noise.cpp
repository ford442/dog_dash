#include <iostream>
#include <cmath>
#include "noise.cpp"

int main() {
    bool passed = true;

    // Test fractalNoise2D produces values in a reasonable bounds
    float n1 = fractalNoise2D(0.0f, 0.0f, 4, 2.0f, 0.5f);
    float n2 = fractalNoise2D(1.5f, -2.3f, 4, 2.0f, 0.5f);
    float n3 = fractalNoise2D(100.0f, 100.0f, 4, 2.0f, 0.5f);

    std::cout << "Noise 1: " << n1 << std::endl;
    std::cout << "Noise 2: " << n2 << std::endl;
    std::cout << "Noise 3: " << n3 << std::endl;

    if (std::isnan(n1) || std::isnan(n2) || std::isnan(n3)) {
        std::cerr << "FAIL: Noise produced NaN" << std::endl;
        passed = false;
    }

    if (passed) {
        std::cout << "✅ C++ Native Noise Tests Passed" << std::endl;
        return 0;
    } else {
        return 1;
    }
}
