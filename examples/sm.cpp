#include <iostream>
#include <string>
#include "dyno.h"

std::string f(int rep, char c)
{
    std::string result{""};
    for (int i {0}; i < rep; ++i)
    {
        result += c;
    }
    return result;
}

int main()
{
    int n {5};
    char c {'*'};
    std::cout << f(n, c) << "\n";
}