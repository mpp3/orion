#include "dyno.h"
#include <iostream>

using namespace std;

int redondear(double x)
{
    int y;
    if (x > 0) {
        y = x + 0.5;
    }
    else {
        y = x - 0.5;
    }
    return y;
}

int main()
{
    double a {3.4};
    double b {3.6};
    int ra, rb;
    ra = redondear(a);
    rb = redondear(b);
}
