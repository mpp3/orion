#include "dyno.h"
#include "ticlib.h"

void fila(int longitud)
{
    for (int i {0}; i < longitud; ++i) {
        cout << "*";
    }
    cout << "\n";
}

void cuadro(int anchura, int altura)
{
    for (int i {0}; i < altura; ++i) {
        fila(anchura);
    }
}
 
int main()
{
    cuadro(3, 2);
    cout << "\n";
    cuadro(2, 3);
}