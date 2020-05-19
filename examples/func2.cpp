#include "dyno.h"
#include <iostream>

using namespace std;

void cuadrado(int num)
{
    num = num * num;
}

void cuadrado2(int &x)
{
    x = x * x;
}

int cuadrado3(int x)
{
    return x * x;
}

int main()
{
    int num{5};
    cuadrado(num);
    // num?
    cuadrado2(num);
    // num?
    num = cuadrado3(num);
    // num?
    cout << num;
}