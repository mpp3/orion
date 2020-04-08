#include <iostream>
#include <fstream>
#include <cstring>

namespace dyno
{
constexpr int max_allocations = 1024;
constexpr int line_size = 50;
constexpr int alloc_buffer_size = 1024;

class Memory
{
public:
	void allocate(void *address, size_t size);
	void free(void *address);
	const char *as_str();

private:
	void *addresses_[max_allocations];
	size_t sizes_[max_allocations];
	int allocations_ = 0;
	char buffer[line_size * max_allocations];
};

void Memory::allocate(void *address, size_t size)
{
	bool duplicate{false};
	for (int i{0}; i < allocations_; ++i)
	{
		if (addresses_[i] == address)
		{
			duplicate = true;
			break;
		}
	}
	if (!duplicate)
	{
		if (allocations_ < max_allocations)
		{
			addresses_[allocations_] = address;
			sizes_[allocations_] = size;
			allocations_++;
		}
		else
		{
			std::cerr << "Reached allocations limit\n";
		}
	}
}

void Memory::free(void *address)
{
	bool found{false};
	for (int i{0}; i < allocations_; ++i)
	{
		if (addresses_[i] == address)
		{
			addresses_[i] = addresses_[allocations_];
			sizes_[i] = sizes_[allocations_];
			allocations_--;
		}
	}
}

void push(char *destination, size_t &offset, const char *source)
{
	strcpy(destination + offset, source);
	offset += strlen(source);
}

const char *Memory::as_str()
{
	size_t offset{0};
	push(buffer, offset, "[\n");
	for (int i{0}; i < allocations_; ++i)
	{
		if (i != 0)
		{
			push(buffer, offset, ",\n");
		}
		char alloc_buffer[alloc_buffer_size];
		sprintf(alloc_buffer,
				"{\"address\":\"%p\", \"size\":%zu}",
				addresses_[i],
				sizes_[i]);
		push(buffer, offset, alloc_buffer);
	}
	push(buffer, offset, "\n]\n");
	return buffer;
}

Memory memory;
const char mem_file_name[8] = "mem.txt";
} // namespace dyno

void *operator new(size_t size)
{
	FILE *mem_file = fopen(dyno::mem_file_name, "w");
	void *address = malloc(size);
	dyno::memory.allocate(address, size);
	fputs(dyno::memory.as_str(), mem_file);
	fclose(mem_file);
	return address;
}

void operator delete(void *address)
{
	FILE *mem_file = fopen(dyno::mem_file_name, "w");
	free(address);
	dyno::memory.free(address);
	fputs(dyno::memory.as_str(), mem_file);
	fclose(mem_file);
}
