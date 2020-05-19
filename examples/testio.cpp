#include "dyno.h"
#include <iostream>
#include <string>

int main()
{
    std::string name = "hola";
    while (name != "bye") {
        std::cout << "Hola, " << name << "\n";
        std::cin >> name;
    }
}
