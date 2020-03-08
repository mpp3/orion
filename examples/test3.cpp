#include "dyno.h"

#include <iostream>

int main()
{
    int *px = new int;
    *px = 25;
    std::cout << *px << "\n";
    delete px;
}