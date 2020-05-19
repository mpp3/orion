#include "dyno.h"

int main()
{
    int* pi1 = new int(1);
    int* pi2 = new int(2);
    int* pi3 = new int(3);
    int* pi4 = new int(4);
    int* pi5 = new int(5);
    double* pd1 = new double(1.0);
    double* pd2 = new double(2.0);
    double* pd3 = new double(3.0);
    double* pd4 = new double(4.0);
    double* pd5 = new double(5.0);
    delete pi5;
    int * pi6 = new int(6);
    delete pd1;
    double * pd6 = new double(6.0);
}